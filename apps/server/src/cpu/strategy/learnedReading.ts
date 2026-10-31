import { MAX_TRACKED_TOTAL } from "./handDistribution";
import type { InferenceParams, OpponentBelief } from "./opponentModel";

/**
 * CPU同士の対戦データから学習した「相手の手札合計の読み」。
 *
 * 手札枚数と持っていなさそうなカードから計算した分布（土台）に、
 * 行動履歴から作った特徴ごとの重みを掛けて補正する（条件付きロジットモデル）。
 *   P(合計 = t) ∝ 土台(t) × exp(Σ 重み × 特徴(t))
 * 特徴は「tがどの点数帯か × 手札枚数」「ドボンしなかった点数か」「ドボン返し狙いの点数か」など。
 */

// 学習した読みでは、ドボン返し狙いを確率ではなく「狙いの候補」として拾う（重みは学習で決まる）
export const READING_DETECTION: InferenceParams = {
  excludedTotalFactor: 1,
  lackWeight: 0.3,
  baitMaxHandCount: 4,
  baitWeights: {
    draw4: 1,
    wild: 1,
    skip: 1,
    reverse: 1,
    draw2: 1,
    "force-change": 1,
  },
};

const GROUP_COUNT = 9;
const HAND_BUCKETS = 6;
const BAIT_SOURCES = [
  "draw4",
  "wild",
  "skip",
  "reverse",
  "draw2",
  "force-change",
];
const LAST_VALUES = [...BAIT_SOURCES, "number"];

const OFFSET_GROUP_HAND = GROUP_COUNT;
const OFFSET_EXCLUDED = OFFSET_GROUP_HAND + GROUP_COUNT * HAND_BUCKETS;
const OFFSET_BAIT = OFFSET_EXCLUDED + 1 + HAND_BUCKETS;
const OFFSET_LAST = OFFSET_BAIT + BAIT_SOURCES.length + HAND_BUCKETS;
const OFFSET_DRAWN = OFFSET_LAST + LAST_VALUES.length;
export const FEATURE_COUNT = OFFSET_DRAWN + GROUP_COUNT;

/** ある相手について、特徴を作るのに使う情報 */
export interface ReadingContext {
  hand: number;
  excluded: Set<number>;
  baitTotal: number;
  baitSource: number;
  lastPoints: number;
  lastValue: number;
  drawn: boolean;
}

export function readingContext(
  belief: OpponentBelief | undefined,
  handCount: number,
): ReadingContext {
  const lastValue = belief?.lastPlay
    ? LAST_VALUES.indexOf(belief.lastPlay.value)
    : -1;
  return {
    hand: Math.min(Math.max(handCount, 1), HAND_BUCKETS) - 1,
    excluded: belief?.excludedTotals ?? new Set(),
    baitTotal: belief?.bait?.total ?? -1,
    baitSource: belief?.bait ? BAIT_SOURCES.indexOf(belief.bait.source) : -1,
    lastPoints: belief?.lastPlay?.points ?? -1,
    lastValue:
      lastValue === -1 && belief?.lastPlay ? LAST_VALUES.length - 1 : lastValue,
    drawn: (belief?.drawnSincePlay ?? 0) > 0,
  };
}

// 合計点の帯: 0 / 1〜9 / 10 / 20 / 30 / 40 / 50 / その他 / 上限超え
function totalGroup(total: number): number {
  if (total > MAX_TRACKED_TOTAL) return 8;
  if (total === 0) return 0;
  if (total < 10) return 1;
  if (total === 10) return 2;
  if (total === 20) return 3;
  if (total === 30) return 4;
  if (total === 40) return 5;
  if (total === 50) return 6;
  return 7;
}

/** 合計点 t について、立っている特徴の番号を out に入れる */
export function featureIds(
  total: number,
  ctx: ReadingContext,
  out: number[],
): void {
  out.length = 0;
  const group = totalGroup(total);
  out.push(group);
  out.push(OFFSET_GROUP_HAND + group * HAND_BUCKETS + ctx.hand);
  if (ctx.excluded.has(total)) {
    out.push(OFFSET_EXCLUDED);
    out.push(OFFSET_EXCLUDED + 1 + ctx.hand);
  }
  if (total === ctx.baitTotal && ctx.baitSource >= 0) {
    out.push(OFFSET_BAIT + ctx.baitSource);
    out.push(OFFSET_BAIT + BAIT_SOURCES.length + ctx.hand);
  }
  if (total === ctx.lastPoints && ctx.lastValue >= 0) {
    out.push(OFFSET_LAST + ctx.lastValue);
  }
  if (ctx.drawn) out.push(OFFSET_DRAWN + group);
}

/**
 * 土台の分布を、学習した重みで補正した分布（添字が合計点、末尾は上限超え）。
 */
export function learnedDistribution(
  base: number[],
  ctx: ReadingContext,
  weights: readonly number[],
): number[] {
  const dist = new Array<number>(base.length).fill(0);
  const ids: number[] = [];
  let sum = 0;
  for (let t = 0; t < base.length; t++) {
    if (base[t] === 0) continue;
    featureIds(t, ctx, ids);
    let score = 0;
    for (const id of ids) score += weights[id];
    dist[t] = base[t] * Math.exp(score);
    sum += dist[t];
  }
  if (sum === 0) return base.slice();
  for (let t = 0; t < dist.length; t++) dist[t] /= sum;
  return dist;
}
