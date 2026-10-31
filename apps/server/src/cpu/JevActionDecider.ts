import {
  CARD_POINTS,
  type Card,
  type GameState,
  type Player,
} from "@dobon-uno/shared";
import {
  type ChoiceCriteria,
  type ChoiceQuestion,
  type ContentValue,
  choice,
  TypeSafeClient,
  type TypeSafeClientConfig,
} from "@typesafe-ai/sdk";
import type { ActionDecider, CPUDecision } from "./ActionDecider";
import { writeCpuLog } from "./cpuLog";

// 挙動が変わらないようにバージョンを固定する
const JEV_MODEL = "jev-1.14";

const COLORS = ["red", "blue", "green", "yellow"] as const;

// 手札合計がいずれかのカードの点数と一致すれば、ドボンを狙える
const DOBON_TARGET_POINTS = new Set(Object.values(CARD_POINTS));

type JevState = { [key: string]: ContentValue };

type JevQuestions = {
  action?: ChoiceQuestion;
  card?: ChoiceQuestion;
  color?: ChoiceQuestion;
};

type JevAnswers = {
  [K in keyof JevQuestions]?: { choice: string };
};

export type JevPlan =
  | { kind: "fixed"; decision: CPUDecision }
  | {
      kind: "ask";
      state: JevState;
      questions: JevQuestions;
      // 質問しなかった場合（選択肢が1つ）に使う値
      onlyAction?: string;
      onlyCardId?: string;
    };

interface JevLog {
  timestamp: string;
  cpuName: string;
  model: string;
  requestId: string | undefined;
  state: JevState;
  questions: JevQuestions;
  answers: unknown;
  usage: unknown;
  decision: CPUDecision;
}

interface JevActionDeciderOptions {
  // テストで fetch などを差し替えるための設定
  clientConfig?: TypeSafeClientConfig;
  log?: (log: JevLog) => void;
}

/**
 * TypeSafe AI の Jev（判断モデル）でCPUの行動を決める。
 *
 * 接続先とAPIキーは SDK の環境変数で指定する。
 * - TYPESAFE_API_KEY: APIキー（OpenRouter経由ならOpenRouterのキー）
 * - TYPESAFE_BASE_URL: OpenRouter経由なら https://openrouter.ai/api
 */
export class JevActionDecider implements ActionDecider {
  private client?: TypeSafeClient;

  constructor(private readonly options: JevActionDeciderOptions = {}) {}

  async decide(state: GameState, cpuPlayer: Player): Promise<CPUDecision> {
    const plan = planJevRequest(state, cpuPlayer);
    if (plan.kind === "fixed") {
      return plan.decision;
    }

    const { data, requestId } = await this.getClient()
      .systemOne({ state: plan.state, questions: plan.questions })
      .withResponse();

    const decision = toDecision(plan, data.answers);

    (this.options.log ?? writeCpuLog)({
      timestamp: new Date().toISOString(),
      cpuName: cpuPlayer.name,
      model: data.model,
      requestId,
      state: plan.state,
      questions: plan.questions,
      answers: data.answers,
      usage: data.usage,
      decision,
    });

    return decision;
  }

  // APIキー未設定でもルーム生成が失敗しないよう、初回の判断時に作る
  private getClient(): TypeSafeClient {
    this.client ??= new TypeSafeClient({
      defaultModel: JEV_MODEL,
      // CPUの思考時間の演出（3秒）に収まるよう短めにする
      timeout: 5000,
      retry: { maxRetries: 1 },
      ...this.options.clientConfig,
    });
    return this.client;
  }
}

/**
 * Jevに投げる質問を組み立てる。選択肢が1つしかなければAPIを呼ばずに決める。
 */
export function planJevRequest(state: GameState, player: Player): JevPlan {
  if (player.canDobonReturn) {
    return { kind: "fixed", decision: { action: "dobonReturn" } };
  }
  if (player.canDobon) {
    return { kind: "fixed", decision: { action: "dobon" } };
  }

  const jevState = buildState(state, player);

  if (player.canChooseColor) {
    return {
      kind: "ask",
      state: jevState,
      questions: { color: buildColorQuestion(player) },
    };
  }

  const playableCards = player.myHand.filter((card) =>
    player.playableCards.get(card.id),
  );
  const actions = buildActionCriteria(state, player, playableCards.length > 0);
  const actionNames = Object.keys(actions);

  if (actionNames.length === 0) {
    throw new Error("No available CPU action");
  }

  const questions: JevQuestions = {};
  if (actionNames.length > 1) {
    questions.action = choice(
      "ドボンUNOのCPUプレイヤーとして、`myHand` と `opponents` を踏まえて次に取るべき行動を選ぶ。手札が多いときは守り（ドボンされないこと）、少ないときは攻め（上がり）を重視する。",
      actions,
    );
  }
  if (playableCards.length > 1) {
    questions.card = choice(
      "カードを出す場合にどのカードを出すかを選ぶ。上がりに近づき、相手にドボンされにくく、出した後の手札合計でドボンを狙えるカードを優先する。記号カード（skip, reverse, draw2, wild, draw4）は点数が高いので早めに切る。",
      buildCardCriteria(state, player, playableCards),
    );
  }

  const onlyAction = actionNames.length === 1 ? actionNames[0] : undefined;
  const onlyCardId =
    playableCards.length === 1 ? playableCards[0].id : undefined;

  // 行動もカードも一択なら質問不要
  if (!questions.action && !questions.card) {
    return {
      kind: "fixed",
      decision:
        onlyAction === "playCard"
          ? { action: "playCard", params: { cardId: onlyCardId } }
          : { action: onlyAction as string },
    };
  }

  return { kind: "ask", state: jevState, questions, onlyAction, onlyCardId };
}

/**
 * Jevの回答をCPUの行動に変換する。選択肢にない回答はエラーにしてフォールバックさせる。
 */
export function toDecision(
  plan: Extract<JevPlan, { kind: "ask" }>,
  answers: JevAnswers,
): CPUDecision {
  const { questions } = plan;

  if (questions.color) {
    const color = pickLabel(questions.color, answers.color, "color");
    return { action: "chooseColor", params: { color } };
  }

  const action = questions.action
    ? pickLabel(questions.action, answers.action, "action")
    : plan.onlyAction;
  if (!action) {
    throw new Error("Jev did not decide an action");
  }

  if (action !== "playCard") {
    return { action };
  }

  const cardId = questions.card
    ? pickLabel(questions.card, answers.card, "card")
    : plan.onlyCardId;
  return { action, params: { cardId } };
}

function pickLabel(
  question: ChoiceQuestion,
  answer: { choice: string } | undefined,
  name: string,
): string {
  const label = answer?.choice;
  if (!label || !(label in question.criteria)) {
    throw new Error(`Jev returned an invalid ${name}: ${String(label)}`);
  }
  return label;
}

function buildState(state: GameState, player: Player): JevState {
  const fieldCard = state.fieldCards[state.fieldCards.length - 1];
  return {
    field: fieldCard ? describeCard(fieldCard) : null,
    currentColor: state.currentColor,
    drawStack: state.drawStack,
    myHand: {
      cards: player.myHand.map(describeCard),
      cardCount: player.myHand.length,
      totalPoints: sumPoints(player.myHand),
    },
    opponents: getOpponents(state, player).map((p) => ({
      name: p.name,
      handCount: p.handCount,
    })),
  };
}

function buildActionCriteria(
  state: GameState,
  player: Player,
  hasPlayableCards: boolean,
): ChoiceCriteria {
  const criteria: ChoiceCriteria = {};
  if (hasPlayableCards) {
    criteria.playCard = "手札からカードを1枚出して上がりに近づく";
  }
  if (player.canDraw) {
    criteria.drawCard =
      "山札から1枚引く。出せるカードを出すと相手にドボンされる危険が高いときに選ぶ";
  }
  if (player.canDrawStack) {
    criteria.drawStack = `累積ドローの${state.drawStack}枚をすべて引く。重ねて出せるカードがないときに選ぶ`;
  }
  if (player.canPass) {
    criteria.pass =
      "パスして手番を渡す。出せるカードがない、または出すと相手にドボンされる危険が高いときに選ぶ";
  }
  return criteria;
}

function buildCardCriteria(
  state: GameState,
  player: Player,
  playableCards: Card[],
): ChoiceCriteria {
  const opponents = getOpponents(state, player);
  const total = sumPoints(player.myHand);
  const criteria: ChoiceCriteria = {};

  for (const card of playableCards) {
    const rest = total - card.points;
    const threats = opponents
      .filter((p) => mayMakePoints(p.handCount, card.points))
      .map((p) => p.name);

    const notes = [
      `${card.color}の${card.value}（${card.points}点）`,
      `出した後の手札合計は${rest}点${DOBON_TARGET_POINTS.has(rest) ? "でドボンを狙える" : ""}`,
      threats.length > 0
        ? `手札枚数から${threats.join("、")}にドボンされる恐れがある`
        : "ドボンされる恐れは低い",
    ];
    criteria[card.id] = notes.join("。");
  }
  return criteria;
}

function buildColorQuestion(player: Player): ChoiceQuestion {
  const criteria: ChoiceCriteria = {};
  for (const color of COLORS) {
    const count = player.myHand.filter((c) => c.color === color).length;
    criteria[color] = `${color}。手札に${count}枚ある`;
  }
  return choice(
    "ワイルドカードを出した後の色を選ぶ。手札に多い色、または次に出したいカードの色を選ぶ。",
    criteria,
  );
}

// 手札枚数から、その点数ちょうどの手札を持っている可能性があるかの目安
function mayMakePoints(handCount: number, points: number): boolean {
  if (points <= 10) return handCount <= 3;
  if (points === 20)
    return handCount === 1 || handCount === 3 || handCount === 4;
  return handCount === 1 || (handCount >= 4 && handCount <= 7);
}

function getOpponents(state: GameState, player: Player): Player[] {
  const opponents: Player[] = [];
  state.players.forEach((p) => {
    if (p.sessionId !== player.sessionId) opponents.push(p);
  });
  return opponents;
}

function describeCard(card: Card) {
  return {
    id: card.id,
    color: card.color,
    value: card.value,
    points: card.points,
  };
}

function sumPoints(cards: Iterable<Card>): number {
  let sum = 0;
  for (const card of cards) sum += card.points;
  return sum;
}
