import type { Card, GameState, Player } from "@dobon-uno/shared";
import { isSymbolCard } from "../../utils/playerActions";
import type { ActionDecider, CPUDecision } from "../ActionDecider";
import type { CardKind, GameLog } from "../GameLog";
import {
  buildUnseenPool,
  MAX_TRACKED_TOTAL,
  type PoolEntry,
} from "./handDistribution";
import {
  learnedDistribution,
  READING_DETECTION,
  readingContext,
} from "./learnedReading";
import {
  averagePoints,
  baseTotalDistribution,
  DEFAULT_INFERENCE,
  expectedTotal,
  type InferenceParams,
  inferBeliefs,
  type OpponentBelief,
  opponentTotalDistribution,
  sumPoints,
} from "./opponentModel";

const COLORS = ["red", "blue", "green", "yellow"] as const;

/** 評価関数の重み（シミュレーターで調整する） */
export interface StrategyWeights {
  // 手札に残る1点あたりのコスト（誰かが上がると払う）
  holdCost: number;
  // 手札1枚あたりのコスト（上がりから遠くなる）
  cardCost: number;
  // 自分がドボンできる見込みの重み
  dobonChance: number;
  // 山札を引いた後にもう一度カードを選べることの価値
  drawOption: number;
  // 次の人に引かせる1枚あたり・スキップ1回あたりの価値
  tempo: number;
  // ドボン返しされる確率がこれ以上ならドボンを見送る
  maxDobonReturnRisk: number;
  // 色変えで選ばれた色のカードを出したとき、その人にドボンされる確率に掛ける係数
  trapColorFactor: number;
}

// CPU同士の対戦シミュレーション（pnpm --filter server simulate）で調整した値
export const DEFAULT_WEIGHTS: StrategyWeights = {
  holdCost: 0.2,
  cardCost: 2,
  dobonChance: 1.5,
  drawOption: 2,
  tempo: 0.25,
  // ドボンの期待値は「全員の手札合計 ×（1 − 2 × ドボン返しされる確率）」なので、0.5が損得の境目
  maxDobonReturnRisk: 0.5,
  trapColorFactor: 1.5,
};

export interface StrategyOptions {
  weights?: StrategyWeights;
  // 手で決めた推論（readingを使わないとき）
  inference?: InferenceParams;
  // 対戦データから学習した読みの重み（learnedReadingWeights.ts）。指定すると手で決めた推論の代わりに使う。
  // 今は手で決めた推論の方が強いので、既定では使わない
  reading?: readonly number[];
  onTrace?: DecisionTraceListener;
}

export interface OpponentView {
  sessionId: string;
  handCount: number;
  // 手札合計点の確率分布（添字が合計点、末尾は上限超え）
  dist: number[];
  mean: number;
  belief?: OpponentBelief;
}

export interface Observation {
  pool: PoolEntry[];
  poolSize: number;
  opponents: OpponentView[];
  opponentsTotal: number;
}

export interface Candidate {
  decision: CPUDecision;
  score: number;
  // カードを出す手のとき、出すカードと誰かにドボンされる確率（相手ごとの和）
  cards?: CardKind[];
  dobonRisk?: number;
}

/** CPUが判断したときに見ていたもの（可視化・検証用） */
export interface DecisionTrace {
  kind: "action" | "dobon";
  playerId: string;
  // 判断した時点の行動履歴の件数
  eventCount: number;
  decision: CPUDecision;
  opponents: OpponentView[];
  candidates: Candidate[];
  // ドボンの判断で使った、ドボン返しされる確率
  returnRisk?: number;
}

export type DecisionTraceListener = (
  trace: DecisionTrace,
  state: GameState,
) => void;

/**
 * 公開情報と行動履歴から相手の手札合計を確率で読み、評価関数で行動を決めるCPU。
 * カットインはしない。
 */
export class StrategyActionDecider implements ActionDecider {
  private readonly weights: StrategyWeights;
  private readonly inference: InferenceParams;
  private readonly reading?: readonly number[];
  private readonly onTrace?: DecisionTraceListener;

  constructor(
    private readonly log: GameLog,
    options: StrategyOptions = {},
  ) {
    this.weights = options.weights ?? DEFAULT_WEIGHTS;
    this.inference = options.inference ?? DEFAULT_INFERENCE;
    this.reading = options.reading;
    this.onTrace = options.onTrace;
  }

  async decide(state: GameState, me: Player): Promise<CPUDecision> {
    if (me.canDobonReturn) return { action: "dobonReturn" };

    const view = this.observe(state, me);
    if (me.canDobon && this.shouldDobon(state, me, view)) {
      return this.trace("action", state, me, view, { action: "dobon" }, []);
    }
    if (me.canChooseColor) {
      const decision = {
        action: "chooseColor",
        params: { color: chooseColor(me, view) },
      };
      return this.trace("action", state, me, view, decision, []);
    }

    const candidates = this.listCandidates(state, me, view);
    if (candidates.length === 0) {
      throw new Error("No available CPU action");
    }
    candidates.sort((a, b) => b.score - a.score);
    return this.trace(
      "action",
      state,
      me,
      view,
      candidates[0].decision,
      candidates,
    );
  }

  decideDobon(state: GameState, me: Player): boolean {
    const view = this.observe(state, me);
    const dobon = this.shouldDobon(state, me, view);
    if (this.onTrace) {
      this.trace(
        "dobon",
        state,
        me,
        view,
        { action: dobon ? "dobon" : "skipDobon" },
        [],
        this.returnRisk(state, me, view),
      );
    }
    return dobon;
  }

  private trace(
    kind: DecisionTrace["kind"],
    state: GameState,
    me: Player,
    view: Observation,
    decision: CPUDecision,
    candidates: Candidate[],
    returnRisk?: number,
  ): CPUDecision {
    this.onTrace?.(
      {
        kind,
        playerId: me.sessionId,
        eventCount: this.log.getEvents().length,
        decision,
        opponents: view.opponents,
        candidates,
        returnRisk,
      },
      state,
    );
    return decision;
  }

  /**
   * ドボンするか。ドボン返しされそうなら見送る。
   * 見送ると進行が止まる場面（上がりへのドボン、他の人が先にドボンした）では必ずドボンする。
   */
  private shouldDobon(
    state: GameState,
    me: Player,
    view: Observation,
  ): boolean {
    if (state.dobonPlayerIds.length > 0) return true;
    const target = state.players.get(state.dobonTargetId);
    if (!target || target.handCount === 0) return true;
    return this.returnRisk(state, me, view) < this.weights.maxDobonReturnRisk;
  }

  /** ドボンしたら、ドボン返しされる確率（ドボンされた人の残りが自分の合計と同じ確率） */
  private returnRisk(state: GameState, me: Player, view: Observation): number {
    const myTotal = sumPoints(me.myHand);
    const opponent = view.opponents.find(
      (o) => o.sessionId === state.dobonTargetId,
    );
    if (!opponent || myTotal > MAX_TRACKED_TOTAL) return 0;
    return opponent.dist[myTotal];
  }

  /**
   * 今の局面の読みと、評価の高い順に並べた候補手（先読み探索の土台に使う）。
   */
  analyze(
    state: GameState,
    me: Player,
  ): { view: Observation; candidates: Candidate[] } {
    const view = this.observe(state, me);
    const candidates = this.listCandidates(state, me, view);
    candidates.sort((a, b) => b.score - a.score);
    return { view, candidates };
  }

  private observe(state: GameState, me: Player): Observation {
    const pool = buildUnseenPool(state, me);
    const reading = this.reading;
    const beliefs = inferBeliefs(
      this.log.getEvents(),
      state.players.keys(),
      reading ? READING_DETECTION : this.inference,
    );
    const opponents: OpponentView[] = [];
    state.players.forEach((p) => {
      if (p.sessionId === me.sessionId) return;
      const belief = beliefs.get(p.sessionId);
      const dist = reading
        ? learnedDistribution(
            baseTotalDistribution(belief, p.handCount, pool, READING_DETECTION),
            readingContext(belief, p.handCount),
            reading,
          )
        : opponentTotalDistribution(belief, p.handCount, pool, this.inference);
      opponents.push({
        sessionId: p.sessionId,
        handCount: p.handCount,
        dist,
        mean: expectedTotal(dist, p.handCount, pool),
        belief,
      });
    });
    return {
      pool,
      poolSize: pool.reduce((sum, e) => sum + e.count, 0),
      opponents,
      opponentsTotal: opponents.reduce((sum, o) => sum + o.mean, 0),
    };
  }

  private listCandidates(
    state: GameState,
    me: Player,
    view: Observation,
  ): Candidate[] {
    const hand = [...me.myHand];
    const myTotal = sumPoints(hand);
    const candidates: Candidate[] = [];

    for (const cards of listPlays(hand, me)) {
      const { score, dobonRisk } = this.scorePlay(
        cards,
        hand.length,
        myTotal,
        view,
      );
      candidates.push({
        decision: {
          action: "playCard",
          params: { cardIds: cards.map((c) => c.id) },
        },
        score,
        cards,
        dobonRisk,
      });
    }

    if (me.canDraw) {
      let expected = 0;
      for (const entry of view.pool) {
        expected +=
          (entry.count / view.poolSize) *
          this.holdValue(myTotal + entry.points, hand.length + 1, view);
      }
      candidates.push({
        decision: { action: "drawCard" },
        score: expected + this.weights.drawOption,
      });
    }
    if (me.canPass) {
      candidates.push({
        decision: { action: "pass" },
        score: this.holdValue(myTotal, hand.length, view),
      });
    }
    if (me.canDrawStack) {
      const count = state.drawStack;
      candidates.push({
        decision: { action: "drawStack" },
        score: this.holdValue(
          myTotal + count * averagePoints(view.pool),
          hand.length + count,
          view,
        ),
      });
    }
    return candidates;
  }

  /**
   * カードを出す手の評価。
   * 出した点数ちょうどの手札の人にドボンされる損失（残りが同じ点数ならドボン返しで得）と、
   * 出した後の手札の価値（上がれるなら相手の手札合計を受け取る）を合わせる。
   */
  private scorePlay(
    cards: CardKind[],
    handCount: number,
    myTotal: number,
    view: Observation,
  ): { score: number; dobonRisk: number } {
    const played = sumPoints(cards);
    const rest = myTotal - played;
    const restCount = handCount - cards.length;
    // ドボンされたときに払う額（出したカードを含む全員の手札合計）
    const pot = myTotal + view.opponentsTotal;
    const canReturn = rest === played;

    let dobonExpected = 0;
    let noDobon = 1;
    for (const opponent of view.opponents) {
      let p = played <= MAX_TRACKED_TOTAL ? opponent.dist[played] : 0;
      if (opponent.belief?.trapColor === cards[0].color) {
        p = Math.min(1, p * this.weights.trapColorFactor);
      }
      dobonExpected += p;
      noDobon *= 1 - p;
    }

    const after =
      restCount === 0
        ? view.opponentsTotal
        : this.holdValue(rest, restCount, view);
    const dobonValue = dobonExpected * pot * (canReturn ? 1 : -1);
    return {
      score: noDobon * after + dobonValue + this.tempoValue(cards),
      dobonRisk: dobonExpected,
    };
  }

  /** 手番を終えて手札を持ち続けるときの価値 */
  private holdValue(total: number, count: number, view: Observation): number {
    const { holdCost, cardCost, dobonChance } = this.weights;
    // 相手が自分の合計点ちょうどのカードを出してくれる見込み。
    // 場に出せるか・相手の手札枚数まで数えた計算も試したが、この単純な形の方が強かった
    let matching = 0;
    for (const entry of view.pool) {
      if (entry.points === total) matching += entry.count;
    }
    const chance =
      view.poolSize === 0
        ? 0
        : (matching / view.poolSize) * view.opponents.length;
    return (
      -holdCost * total -
      cardCost * count +
      dobonChance * chance * (total + view.opponentsTotal)
    );
  }

  private tempoValue(cards: CardKind[]): number {
    const value = cards[0].value;
    const perCard =
      value === "draw2" ? 2 : value === "draw4" ? 4 : value === "skip" ? 1 : 0;
    return this.weights.tempo * perCard * cards.length;
  }
}

/**
 * 出せるカードの組み合わせ（同じカードの重ね出しを含む）を列挙する。
 */
export function listPlays(hand: Card[], me: Player): Card[][] {
  const plays: Card[][] = [];
  const seen = new Set<string>();
  for (const first of hand) {
    if (!me.playableCards.get(first.id)) continue;
    const same = hand.filter((c) => c.id !== first.id && canStack(first, c));
    for (let extra = 0; extra <= same.length; extra++) {
      const cards = [first, ...same.slice(0, extra)];
      // 記号カードの重ね出しで手札を出し切ることはできない
      if (cards.length === hand.length && isSymbolCard(first)) continue;
      const key = `${first.color}:${first.value}:${cards.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plays.push(cards);
    }
  }
  return plays;
}

function canStack(first: Card, card: Card): boolean {
  if (first.value === "force-change") return card.value === "force-change";
  return card.color === first.color && card.value === first.value;
}

/**
 * 色選択。手札に多い色を選び、パスした相手が持っていなさそうな色を少し優先する。
 * （自分の合計点のカードが出やすい色を選ぶ方法も試したが、弱くなった）
 */
function chooseColor(me: Player, view: Observation): string {
  let best: string = COLORS[0];
  let bestScore = -Infinity;
  for (const color of COLORS) {
    let score = 0;
    for (const card of me.myHand) {
      if (card.color === color) score += 1 + card.points / 100;
    }
    for (const opponent of view.opponents) {
      const lacks = opponent.belief?.lacks ?? [];
      if (lacks.some((l) => l.kind === "pass" && l.color === color)) {
        score += 0.3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = color;
    }
  }
  return best;
}
