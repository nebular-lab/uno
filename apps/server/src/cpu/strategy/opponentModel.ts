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
export type Lack =
  | { kind: "pass"; color: string; value: string }
  | { kind: "stack"; value: string };

/** 行動履歴から読み取った、ある相手の手札についての推論 */
export interface OpponentBelief {
  // ドボンしなかったことから、今の手札合計ではないと分かっている点数
  excludedTotals: Set<number>;
  // 危険な場面で記号カードを出した人は、ドボン返し狙いで残りをその点数にしていそう
  // source は読みのきっかけになったカード（draw4 / wild / skip など）
  bait?: { total: number; weight: number; source: string };
  lacks: Lack[];
  // 色変えで選んだ色。次に行動するまで、その色のカードを待っていそう
  trapColor?: string;
  // 最後に出したカード（学習した読みの手がかり）
  lastPlay?: { points: number; value: string; handCountAfter: number };
  // 最後にカードを出してから引いた枚数
  drawnSincePlay: number;
}

/** 行動履歴からの推論に使う定数（CPU同士の対戦で調整する） */
export interface InferenceParams {
  // ドボンを宣言しなかった点数の確率に掛ける係数
  excludedTotalFactor: number;
  // 持っていなさそうなカードの重み
  lackWeight: number;
  // ドボン返し狙いとみなす手札枚数の上限（出した後の枚数）
  baitMaxHandCount: number;
  // 記号カードを出した人の残りが、出したカードと同じ点数である確率。
  // 出したカードと同じ点数を手元に残していれば、そのカードにドボンされてもドボン返しできる
  // （例: ドロー4なら残り50点、ワイルドなら30点、スキップ・リバース・ドロー2なら20点）
  baitWeights: Record<string, number>;
}

// CPU同士の対戦で調整した値（pnpm --filter server tune）。
// ドボン返し狙いの読みは、CPU同士ではほとんど当たらず逆効果だったので使わない（確率0）
export const DEFAULT_INFERENCE: InferenceParams = {
  excludedTotalFactor: 0.1,
  lackWeight: 0.3,
  baitMaxHandCount: 4,
  baitWeights: {
    draw4: 0,
    wild: 0,
    skip: 0,
    reverse: 0,
    draw2: 0,
    "force-change": 0,
  },
};

// ドボン返しをよく狙う相手向けの値（調整前の初期値）
export const BAIT_AWARE_INFERENCE: InferenceParams = {
  ...DEFAULT_INFERENCE,
  baitWeights: {
    draw4: 0.5,
    wild: 0.35,
    skip: 0.25,
    reverse: 0.25,
    draw2: 0.25,
    "force-change": 0.2,
  },
};

function emptyBelief(): OpponentBelief {
  return { excludedTotals: new Set(), lacks: [], drawnSincePlay: 0 };
}

/**
 * 行動履歴を頭から読み直して、各プレイヤーの手札についての推論を作る。
 */
export function inferBeliefs(
  events: readonly GameLogEvent[],
  playerIds: Iterable<string>,
  params: InferenceParams = DEFAULT_INFERENCE,
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
        belief.lastPlay = {
          points: played,
          value: event.cards[0].value,
          handCountAfter: event.handCountAfter,
        };
        belief.drawnSincePlay = 0;

        const baitWeight = params.baitWeights[event.cards[0].value];
        // 前の読み（ドロー4の後に20を出したら残り30など）の方が強ければそちらを残す
        if (
          baitWeight !== undefined &&
          baitWeight > 0 &&
          event.handCountAfter > 0 &&
          event.handCountAfter <= params.baitMaxHandCount &&
          baitWeight > (belief.bait?.weight ?? 0)
        ) {
          belief.bait = {
            total: played,
            weight: baitWeight,
            source: event.cards[0].value,
          };
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
        belief.drawnSincePlay += event.count;
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
  params: InferenceParams = DEFAULT_INFERENCE,
): number[] {
  const base = baseTotalDistribution(belief, handCount, pool, params);
  if (!belief) return base;

  const dist = base.slice();
  for (const total of belief.excludedTotals) {
    if (total <= MAX_TRACKED_TOTAL) dist[total] *= params.excludedTotalFactor;
  }
  normalize(dist);

  const bait = belief.bait;
  if (bait && bait.total <= MAX_TRACKED_TOTAL && base[bait.total] > 0) {
    for (let t = 0; t < dist.length; t++) dist[t] *= 1 - bait.weight;
    dist[bait.total] += bait.weight;
  }
  return dist;
}

/**
 * 手札枚数と「持っていなさそうなカード」だけを反映した、手札合計点の分布。
 * ドボンしなかった点数やドボン返し狙いの読みは含まない（学習した読みの土台にする）。
 */
export function baseTotalDistribution(
  belief: OpponentBelief | undefined,
  handCount: number,
  pool: PoolEntry[],
  params: InferenceParams = DEFAULT_INFERENCE,
): number[] {
  const groups = weightedGroups(pool, belief?.lacks ?? [], params.lackWeight);
  return handTotalDistribution(groups, handCount);
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

function weightedGroups(
  pool: PoolEntry[],
  lacks: Lack[],
  lackWeight: number,
): WeightedGroup[] {
  const groups = new Map<string, WeightedGroup>();
  for (const entry of pool) {
    let weight = 1;
    for (const lack of lacks) {
      if (isCoveredByLack(entry, lack)) weight *= lackWeight;
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

export function normalize(dist: number[]): void {
  const sum = dist.reduce((a, b) => a + b, 0);
  if (sum === 0) return;
  for (let i = 0; i < dist.length; i++) dist[i] /= sum;
}

export function sumPoints(cards: Iterable<CardKind>): number {
  let sum = 0;
  for (const card of cards) sum += card.points;
  return sum;
}
