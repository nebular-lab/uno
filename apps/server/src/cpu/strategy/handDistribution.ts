import type { GameState, Player } from "@dobon-uno/shared";
import { createDeck } from "../../utils/deck";
import type { CardKind } from "../GameLog";

/** 分布で個別に追う合計点の上限。これを超える合計はまとめて1つの区分にする */
export const MAX_TRACKED_TOTAL = 100;

/** まだ見えていないカード（山札＋他人の手札）の種類ごとの枚数 */
export interface PoolEntry extends CardKind {
  count: number;
}

const FULL_DECK: PoolEntry[] = countKinds(createDeck());

/**
 * 自分から見えていないカードを数える。
 * デッキ全体から、自分の手札・場に出たカード・公開された手札を除いたもの。
 */
export function buildUnseenPool(state: GameState, me: Player): PoolEntry[] {
  const seen = new Map<string, number>();
  const see = (card: CardKind) => {
    const key = kindKey(card);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  };

  for (const card of me.myHand) see(card);
  for (const card of state.fieldCards) see(card);
  state.players.forEach((p) => {
    if (p.sessionId === me.sessionId) return;
    for (const card of p.revealedHand) see(card);
  });

  return FULL_DECK.map((entry) => ({
    ...entry,
    count: Math.max(0, entry.count - (seen.get(kindKey(entry)) ?? 0)),
  })).filter((entry) => entry.count > 0);
}

export interface WeightedGroup {
  points: number;
  count: number;
  // 1枚あたりの持っていそうな度合い（1が標準）
  weight: number;
}

/**
 * 未見のカードから n 枚を持っているとき、手札合計点がそれぞれの値になる確率。
 * 戻り値の添字が合計点で、末尾（MAX_TRACKED_TOTAL + 1）は上限を超える合計の確率。
 *
 * 同じ点数のカードをまとめた多変量超幾何分布をDPで数え上げる。
 * weight は「その種類のカードを持っていそうな度合い」で、1枚選ぶごとに掛ける。
 */
export function handTotalDistribution(
  groups: WeightedGroup[],
  n: number,
): number[] {
  const size = MAX_TRACKED_TOTAL + 2;
  const overflow = MAX_TRACKED_TOTAL + 1;

  // ways[k][t] = k枚選んで合計がtになる重み付きの組み合わせ数
  let ways: Float64Array[] = Array.from(
    { length: n + 1 },
    () => new Float64Array(size),
  );
  ways[0][0] = 1;

  for (const group of groups) {
    if (group.count === 0 || group.weight === 0) continue;
    const next = ways.map((row) => row.slice());
    for (let k = 0; k < n; k++) {
      const row = ways[k];
      for (let t = 0; t < size; t++) {
        const base = row[t];
        if (base === 0) continue;
        let coef = 1;
        const maxJ = Math.min(group.count, n - k);
        for (let j = 1; j <= maxJ; j++) {
          coef = (coef * (group.count - j + 1) * group.weight) / j;
          const total =
            t === overflow
              ? overflow
              : Math.min(t + j * group.points, overflow);
          next[k + j][total] += base * coef;
        }
      }
    }
    ways = next;
  }

  const result = Array.from(ways[n]);
  const sum = result.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    // 未見のカードより多く持っている（通常はありえない）
    const fallback = new Array<number>(size).fill(0);
    fallback[overflow] = 1;
    return fallback;
  }
  return result.map((v) => v / sum);
}

export function kindKey(card: CardKind): string {
  return `${card.color}:${card.value}`;
}

function countKinds(cards: CardKind[]): PoolEntry[] {
  const map = new Map<string, PoolEntry>();
  for (const card of cards) {
    const key = kindKey(card);
    const entry = map.get(key);
    if (entry) {
      entry.count++;
    } else {
      map.set(key, {
        color: card.color,
        value: card.value,
        points: card.points,
        count: 1,
      });
    }
  }
  return [...map.values()];
}
