import type { CardKind, GameLogEvent } from "../GameLog";
import {
  handTotalDistribution,
  MAX_TRACKED_TOTAL,
  type PoolEntry,
  type WeightedGroup,
} from "./handDistribution";

/**
 * 「その時点で出せるカードを持っていなかった」という推測。
 * パスした人は場札の色・数字のカードやワイルド類を、累積ドローを引いた人はドローカードを持っていなさそう。
 */
type Lack =
  | { kind: "pass"; color: string; value: string }
  | { kind: "stack"; value: string };

/** 行動履歴から読み取った、ある相手の手札についての推論 */
export interface OpponentBelief {
  // ドボンしなかったことから、今の手札合計ではないと分かっている点数
  excludedTotals: Set<number>;
  // 危険な場面で高得点カードを出した人は、ドボン返し狙いで残りをその点数にしていそう
  bait?: { total: number; weight: number };
  lacks: Lack[];
  // 色変えで選んだ色。次に行動するまで、その色のカードを待っていそう
  trapColor?: string;
}

/** ドボンを宣言しなかった点数の確率に掛ける係数（宣言し忘れもあるので0にはしない） */
export const EXCLUDED_TOTAL_FACTOR = 0.1;
/** 持っていなさそうなカードの重み */
export const LACK_WEIGHT = 0.3;
/** 色変えで選んだ色のカードを出したときに、その人にドボンされる確率に掛ける係数 */
export const TRAP_COLOR_FACTOR = 1.5;

// ドボン返し狙いとみなす条件: 出した後の手札がこの枚数以下で、高得点カードを出した
const BAIT_MAX_HAND_COUNT = 4;
const BAIT_WEIGHT: Record<string, number> = { draw4: 0.5, wild: 0.35 };

function emptyBelief(): OpponentBelief {
  return { excludedTotals: new Set(), lacks: [] };
}

/**
 * 行動履歴を頭から読み直して、各プレイヤーの手札についての推論を作る。
 */
export function inferBeliefs(
  events: readonly GameLogEvent[],
  playerIds: Iterable<string>,
): Map<string, OpponentBelief> {
  const beliefs = new Map<string, OpponentBelief>();
  const beliefOf = (playerId: string) => {
    let belief = beliefs.get(playerId);
    if (!belief) {
      belief = emptyBelief();
      beliefs.set(playerId, belief);
    }
    return belief;
  };
  // まだ行動していない人にも、最初の場札などで分かったことを伝えるため、全員分を先に作る
  for (const playerId of playerIds) beliefOf(playerId);

  for (const event of events) {
    switch (event.type) {
      case "play": {
        const played = sumPoints(event.cards);
        for (const [playerId, belief] of beliefs) {
          if (playerId === event.playerId) continue;
          // 出されたカードにドボンしなかった → 手札合計はその点数ではない
          belief.excludedTotals.add(played);
          if (belief.bait?.total === played) belief.bait = undefined;
        }
        if (!event.playerId) break;

        const belief = beliefOf(event.playerId);
        belief.excludedTotals = shiftTotals(belief.excludedTotals, played);
        if (belief.bait) {
          const total = belief.bait.total - played;
          belief.bait = total >= 0 ? { ...belief.bait, total } : undefined;
        }
        belief.trapColor = undefined;

        const baitWeight = BAIT_WEIGHT[event.cards[0].value];
        if (
          baitWeight !== undefined &&
          event.handCountAfter > 0 &&
          event.handCountAfter <= BAIT_MAX_HAND_COUNT
        ) {
          belief.bait = { total: played, weight: baitWeight };
        }
        break;
      }
      case "draw": {
        // 引いたカードは分からないので、合計点についての推論は使えなくなる
        const belief = beliefOf(event.playerId);
        belief.excludedTotals = new Set();
        belief.bait = undefined;
        belief.lacks = [];
        belief.trapColor = undefined;
        if (event.stackedValue) {
          belief.lacks.push({ kind: "stack", value: event.stackedValue });
        }
        break;
      }
      case "pass": {
        beliefOf(event.playerId).lacks.push({
          kind: "pass",
          color: event.currentColor,
          value: event.fieldValue,
        });
        break;
      }
      case "chooseColor": {
        beliefOf(event.playerId).trapColor = event.color;
        break;
      }
    }
  }

  return beliefs;
}

/**
 * 推論を反映した、相手の手札合計点の確率分布（添字が合計点、末尾は上限超え）。
 */
export function opponentTotalDistribution(
  belief: OpponentBelief | undefined,
  handCount: number,
  pool: PoolEntry[],
): number[] {
  const groups = weightedGroups(pool, belief?.lacks ?? []);
  const base = handTotalDistribution(groups, handCount);
  if (!belief) return base;

  const dist = base.slice();
  for (const total of belief.excludedTotals) {
    if (total <= MAX_TRACKED_TOTAL) dist[total] *= EXCLUDED_TOTAL_FACTOR;
  }
  normalize(dist);

  const bait = belief.bait;
  if (bait && bait.total <= MAX_TRACKED_TOTAL && base[bait.total] > 0) {
    for (let t = 0; t < dist.length; t++) dist[t] *= 1 - bait.weight;
    dist[bait.total] += bait.weight;
  }
  return dist;
}

/** 分布の期待値（上限超えの区分は、平均的なカードで埋めた値で近似する） */
export function expectedTotal(
  dist: number[],
  handCount: number,
  pool: PoolEntry[],
): number {
  let sum = 0;
  for (let t = 0; t <= MAX_TRACKED_TOTAL; t++) sum += dist[t] * t;
  const roughMean = handCount * averagePoints(pool);
  return (
    sum +
    dist[MAX_TRACKED_TOTAL + 1] * Math.max(roughMean, MAX_TRACKED_TOTAL + 1)
  );
}

export function averagePoints(pool: PoolEntry[]): number {
  let count = 0;
  let points = 0;
  for (const entry of pool) {
    count += entry.count;
    points += entry.count * entry.points;
  }
  return count === 0 ? 0 : points / count;
}

function weightedGroups(pool: PoolEntry[], lacks: Lack[]): WeightedGroup[] {
  const groups = new Map<string, WeightedGroup>();
  for (const entry of pool) {
    let weight = 1;
    for (const lack of lacks) {
      if (isCoveredByLack(entry, lack)) weight *= LACK_WEIGHT;
    }
    const key = `${entry.points}:${weight}`;
    const group = groups.get(key);
    if (group) {
      group.count += entry.count;
    } else {
      groups.set(key, { points: entry.points, count: entry.count, weight });
    }
  }
  return [...groups.values()];
}

function isCoveredByLack(card: CardKind, lack: Lack): boolean {
  if (lack.kind === "stack") {
    // draw2にはdraw2とdraw4、draw4にはdraw4だけ重ねられる
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

function shiftTotals(totals: Set<number>, played: number): Set<number> {
  const shifted = new Set<number>();
  for (const total of totals) {
    if (total - played >= 0) shifted.add(total - played);
  }
  return shifted;
}

function normalize(dist: number[]): void {
  const sum = dist.reduce((a, b) => a + b, 0);
  if (sum === 0) return;
  for (let i = 0; i < dist.length; i++) dist[i] /= sum;
}

export function sumPoints(cards: Iterable<CardKind>): number {
  let sum = 0;
  for (const card of cards) sum += card.points;
  return sum;
}
