import { createDeck } from "../../utils/deck";
import type { CardKind } from "../GameLog";
import {
  handTotalDistribution,
  MAX_TRACKED_TOTAL,
  type WeightedGroup,
} from "../strategy/handDistribution";
import {
  drawOne,
  drawStack,
  type FastState,
  handTotal,
  isPlayable,
  passTurn,
  play,
} from "./fastGame";

/**
 * 先読みの中で全員が打つ手の設定。
 * 評価関数のCPU（StrategyActionDecider）と同じ形の評価を、事前に計算した確率表で軽く行う。
 */
export interface RolloutPolicy {
  holdCost: number;
  cardCost: number;
  dobonChance: number;
  drawOption: number;
}

export const DEFAULT_ROLLOUT: RolloutPolicy = {
  holdCost: 0.2,
  cardCost: 2,
  dobonChance: 1.5,
  drawOption: 2,
};

const MAX_STEPS = 400;
const MAX_HAND = 16;
const DECK = createDeck();
const AVERAGE_POINTS =
  DECK.reduce((sum, card) => sum + card.points, 0) / DECK.length;
// 点数ごとの枚数（デッキ全体）
const POINT_COUNTS = (() => {
  const counts = new Map<number, number>();
  for (const card of DECK) {
    counts.set(card.points, (counts.get(card.points) ?? 0) + 1);
  }
  return counts;
})();

// 手札n枚の合計がtになる確率（デッキ全体から配られたとして）。相手の手札を覗かずにドボンの危険を見積もる
const RISK_TABLE: number[][] = (() => {
  const groups: WeightedGroup[] = [...POINT_COUNTS].map(([points, count]) => ({
    points,
    count,
    weight: 1,
  }));
  return Array.from({ length: MAX_HAND + 1 }, (_, n) =>
    n === 0 ? [] : handTotalDistribution(groups, n),
  );
})();

interface Outlook {
  // 相手ごとの手札枚数
  counts: number[];
  opponentsTotal: number;
}

function outlookOf(state: FastState): Outlook {
  const counts: number[] = [];
  state.hands.forEach((hand, i) => {
    if (i !== state.turn) counts.push(hand.length);
  });
  return {
    counts,
    opponentsTotal: counts.reduce((sum, n) => sum + n * AVERAGE_POINTS, 0),
  };
}

function holdValue(
  total: number,
  count: number,
  outlook: Outlook,
  policy: RolloutPolicy,
): number {
  const chance =
    ((POINT_COUNTS.get(total) ?? 0) / DECK.length) * outlook.counts.length;
  return (
    -policy.holdCost * total -
    policy.cardCost * count +
    policy.dobonChance * chance * (total + outlook.opponentsTotal)
  );
}

function scorePlay(
  cards: CardKind[],
  hand: CardKind[],
  outlook: Outlook,
  policy: RolloutPolicy,
): number {
  const total = handTotal(hand);
  const played = handTotal(cards);
  const rest = total - played;
  const restCount = hand.length - cards.length;
  const pot = total + outlook.opponentsTotal;
  let dobon = 0;
  let noDobon = 1;
  if (played <= MAX_TRACKED_TOTAL) {
    for (const n of outlook.counts) {
      if (n === 0) continue;
      const p = RISK_TABLE[Math.min(n, MAX_HAND)][played];
      dobon += p;
      noDobon *= 1 - p;
    }
  }
  const after =
    restCount === 0
      ? outlook.opponentsTotal
      : holdValue(rest, restCount, outlook, policy);
  return noDobon * after + dobon * pot * (rest === played ? 1 : -1);
}

function drawValue(
  hand: CardKind[],
  outlook: Outlook,
  policy: RolloutPolicy,
): number {
  const total = handTotal(hand);
  let value = 0;
  for (const [points, count] of POINT_COUNTS) {
    value +=
      (count / DECK.length) *
      holdValue(total + points, hand.length + 1, outlook, policy);
  }
  return value + policy.drawOption;
}

/**
 * 手番の人が出すカードを選ぶ（undefined なら出さない）。
 * canDraw なら「山札から引く」とも比べ、引く方が良ければ undefined を返す。
 */
export function choosePlay(
  state: FastState,
  policy: RolloutPolicy,
  canDraw = true,
): CardKind[] | undefined {
  const hand = state.hands[state.turn];
  const outlook = outlookOf(state);
  let best: CardKind[] | undefined;
  let bestScore = canDraw
    ? drawValue(hand, outlook, policy)
    : holdValue(handTotal(hand), hand.length, outlook, policy);
  for (const card of hand) {
    if (!isPlayable(state, card)) continue;
    const same = hand.filter(
      (c) =>
        c !== card &&
        (card.value === "force-change"
          ? c.value === "force-change"
          : c.color === card.color && c.value === card.value),
    );
    for (let extra = 0; extra <= same.length; extra++) {
      const cards = [card, ...same.slice(0, extra)];
      if (cards.length === hand.length && SYMBOL_VALUES.has(card.value)) {
        continue;
      }
      const score = scorePlay(cards, hand, outlook, policy);
      if (score > bestScore) {
        best = cards;
        bestScore = score;
      }
    }
  }
  // 累積ドロー中は、重ねられるなら重ねる（引くより得なことがほとんど）
  if (!best && state.drawStack > 0) {
    const stack = hand.find((c) => isPlayable(state, c));
    if (stack) return [stack];
  }
  return best;
}

const SYMBOL_VALUES = new Set([
  "skip",
  "reverse",
  "draw2",
  "wild",
  "draw4",
  "force-change",
]);

/** 手番の人が1手打つ */
export function playTurn(state: FastState, policy: RolloutPolicy): void {
  if (state.drawStack > 0) {
    const cards = choosePlay(state, policy, false);
    if (cards) play(state, cards);
    else drawStack(state);
    return;
  }
  const cards = choosePlay(state, policy);
  if (cards) {
    play(state, cards);
    return;
  }
  if (!drawOne(state)) return;
  afterDraw(state, policy);
}

/** 山札から引いた後: 出せるなら出し、なければパス */
export function afterDraw(state: FastState, policy: RolloutPolicy): void {
  const cards = choosePlay(state, policy, false);
  if (cards) play(state, cards);
  else passTurn(state);
}

/** 終わるまで打ち切って、席ごとの得点の増減を返す */
export function rollout(state: FastState, policy: RolloutPolicy): number[] {
  for (let step = 0; step < MAX_STEPS && !state.result; step++) {
    playTurn(state, policy);
  }
  return state.result ?? state.hands.map(() => 0);
}

export { handTotal };
