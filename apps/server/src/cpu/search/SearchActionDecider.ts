import type { GameState, Player } from "@dobon-uno/shared";
import type { ActionDecider, CPUDecision } from "../ActionDecider";
import type { CardKind, GameLog } from "../GameLog";
import { MAX_TRACKED_TOTAL } from "../strategy/handDistribution";
import {
  DEFAULT_INFERENCE,
  type InferenceParams,
  type Lack,
  type OpponentBelief,
} from "../strategy/opponentModel";
import {
  type Candidate,
  type Observation,
  StrategyActionDecider,
  type StrategyOptions,
} from "../strategy/StrategyActionDecider";
import { drawOne, drawStack, type FastState, passTurn, play } from "./fastGame";
import {
  afterDraw,
  DEFAULT_ROLLOUT,
  type RolloutPolicy,
  rollout,
} from "./rollout";

export interface SearchOptions extends StrategyOptions {
  // 相手の手札・山札の並びを仮定する最大の数
  samples?: number;
  // 1手に使う時間の上限（ms）。指定すると、時間内にできた分だけで決める
  budgetMs?: number;
  // 指定すると、この時間（ms）ごとに処理を譲り、サーバーの他の処理を止めないようにする
  sliceMs?: number;
  // 先読みで比べる候補手の数（評価の高い順）
  topK?: number;
  // 評価関数1位の手から変えるのに必要な確からしさ（点数差の下側の信頼限界 = 平均 - confidence × 標準誤差）
  confidence?: number;
  rollout?: RolloutPolicy;
  seed?: number;
}

/** 先読みに必要な情報（GameStateから切り離した、ただのデータ） */
interface SearchProblem {
  myIndex: number;
  myHand: CardKind[];
  // 席ごとの手札枚数と、その人について読み取ったこと（自分の席は使わない）
  seats: { handCount: number; belief?: OpponentBelief }[];
  unseen: CardKind[];
  top: CardKind;
  color: string;
  drawStack: number;
  direction: number;
  candidates: Candidate[];
}

/**
 * 先読み探索のCPU。今の評価で上位の候補手それぞれについて、
 * 読みに沿って相手の手札と山札を何通りも仮定し、ゲームの最後まで打ち切った点数を比べる。
 * 先読みの結果はばらつきが大きいので、同じ仮定の世界での点数差を取り、
 * 評価関数1位の手よりはっきり良いときだけ手を変える。
 * ドボン・ドボン返し・色選択は評価関数のCPUと同じ判断をする。
 */
export class SearchActionDecider implements ActionDecider {
  private readonly base: StrategyActionDecider;
  private readonly samples: number;
  private readonly budgetMs?: number;
  private readonly sliceMs?: number;
  private readonly topK: number;
  private readonly confidence: number;
  private readonly policy: RolloutPolicy;
  private readonly inference: InferenceParams;
  private readonly random: () => number;

  constructor(log: GameLog, options: SearchOptions = {}) {
    this.base = new StrategyActionDecider(log, options);
    this.samples = options.samples ?? 1000;
    this.budgetMs = options.budgetMs;
    this.sliceMs = options.sliceMs;
    this.topK = options.topK ?? 4;
    this.confidence = options.confidence ?? 2;
    this.policy = options.rollout ?? DEFAULT_ROLLOUT;
    this.inference = options.inference ?? DEFAULT_INFERENCE;
    this.random = mulberry32(options.seed ?? 12345);
  }

  async decide(state: GameState, me: Player): Promise<CPUDecision> {
    const busy =
      me.canDobonReturn ||
      me.canChooseColor ||
      (me.canDobon && this.base.decideDobon(state, me));
    if (busy) return this.base.decide(state, me);

    const { view, candidates } = this.base.analyze(state, me);
    if (candidates.length === 0) throw new Error("No available CPU action");
    if (candidates.length === 1) return candidates[0].decision;

    const problem = buildProblem(
      state,
      me,
      view,
      candidates.slice(0, this.topK),
    );
    const best = await this.solve(problem);
    return problem.candidates[best].decision;
  }

  decideDobon(state: GameState, me: Player): boolean {
    return this.base.decideDobon(state, me);
  }

  /** 候補手の番号を返す（0 は評価関数の1位） */
  private async solve(problem: SearchProblem): Promise<number> {
    const { candidates } = problem;
    const started = Date.now();
    let sliceStarted = started;
    // 評価関数1位の手との点数差（重み付き）
    const diffs = candidates.map(() => ({ sum: 0, sumSq: 0 }));
    let weightSum = 0;
    let weightSqSum = 0;

    for (let s = 0; s < this.samples; s++) {
      const { state: world, weight } = this.sampleWorld(problem);
      const results = candidates.map((candidate) => {
        const copy = cloneWorld(world);
        applyCandidate(copy, candidate, this.policy);
        return rollout(copy, this.policy)[problem.myIndex];
      });
      weightSum += weight;
      weightSqSum += weight * weight;
      for (let k = 1; k < candidates.length; k++) {
        const diff = results[k] - results[0];
        diffs[k].sum += weight * diff;
        diffs[k].sumSq += weight * diff * diff;
      }

      const now = Date.now();
      if (this.budgetMs !== undefined && now - started >= this.budgetMs) break;
      if (this.sliceMs !== undefined && now - sliceStarted >= this.sliceMs) {
        await new Promise((resolve) => setImmediate(resolve));
        sliceStarted = Date.now();
      }
    }
    if (weightSum === 0 || weightSqSum === 0) return 0;

    const effective = (weightSum * weightSum) / weightSqSum;
    let best = 0;
    let bestLower = 0;
    for (let k = 1; k < candidates.length; k++) {
      const mean = diffs[k].sum / weightSum;
      const variance = Math.max(diffs[k].sumSq / weightSum - mean * mean, 0);
      const lower =
        mean - this.confidence * Math.sqrt(variance / Math.max(effective, 1));
      if (lower > bestLower) {
        best = k;
        bestLower = lower;
      }
    }
    return best;
  }

  /**
   * 相手の手札と山札の並びを1通り仮定する。
   * 見えていないカードを配り直し、読み（ドボンしなかった点数・持っていなさそうなカード）で重みをつける。
   */
  private sampleWorld(problem: SearchProblem): {
    state: FastState;
    weight: number;
  } {
    const unseen = problem.unseen;
    shuffle(unseen, this.random);
    let next = 0;
    let weight = 1;
    const hands = problem.seats.map((seat, i) => {
      if (i === problem.myIndex) return problem.myHand.slice();
      const hand = unseen.slice(next, next + seat.handCount);
      next += seat.handCount;
      weight *= this.handWeight(hand, seat.belief);
      return hand;
    });
    return {
      weight,
      state: {
        hands,
        deck: unseen.slice(next),
        top: problem.top,
        color: problem.color,
        drawStack: problem.drawStack,
        turn: problem.myIndex,
        direction: problem.direction,
      },
    };
  }

  private handWeight(hand: CardKind[], belief?: OpponentBelief): number {
    if (!belief) return 1;
    let weight = 1;
    let total = 0;
    for (const card of hand) {
      total += card.points;
      for (const lack of belief.lacks) {
        if (coveredByLack(card, lack)) weight *= this.inference.lackWeight;
      }
    }
    if (total <= MAX_TRACKED_TOTAL && belief.excludedTotals.has(total)) {
      weight *= this.inference.excludedTotalFactor;
    }
    return weight;
  }
}

function buildProblem(
  state: GameState,
  me: Player,
  view: Observation,
  candidates: Candidate[],
): SearchProblem {
  const seats = [...state.players.values()].sort((a, b) => a.seatId - b.seatId);
  const unseen: CardKind[] = [];
  for (const entry of view.pool) {
    for (let i = 0; i < entry.count; i++) {
      unseen.push({
        color: entry.color,
        value: entry.value,
        points: entry.points,
      });
    }
  }
  return {
    myIndex: seats.findIndex((p) => p.sessionId === me.sessionId),
    // 候補手のカードと同じオブジェクトを使う（出したときに手札から取り除くため）
    myHand: [...me.myHand],
    seats: seats.map((p) => ({
      handCount: p.handCount,
      belief: view.opponents.find((o) => o.sessionId === p.sessionId)?.belief,
    })),
    unseen,
    top: state.fieldCards[state.fieldCards.length - 1],
    color: state.currentColor,
    drawStack: state.drawStack,
    direction: state.turnDirection,
    candidates,
  };
}

function cloneWorld(world: FastState): FastState {
  return {
    ...world,
    hands: world.hands.map((h) => h.slice()),
    deck: world.deck.slice(),
  };
}

/** 自分の候補手を仮定した世界で打つ */
function applyCandidate(
  world: FastState,
  candidate: Candidate,
  policy: RolloutPolicy,
): void {
  const { action } = candidate.decision;
  if (action === "playCard" && candidate.cards) {
    play(world, candidate.cards);
  } else if (action === "drawCard") {
    if (drawOne(world)) afterDraw(world, policy);
  } else if (action === "drawStack") {
    drawStack(world);
  } else {
    passTurn(world);
  }
}

function coveredByLack(card: CardKind, lack: Lack): boolean {
  if (lack.kind === "stack") {
    return lack.value === "draw2"
      ? card.value === "draw2" || card.value === "draw4"
      : card.value === "draw4";
  }
  return (
    card.color === lack.color ||
    card.value === lack.value ||
    card.color === "wild" ||
    card.value === "force-change"
  );
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
