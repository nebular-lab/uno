import type { CardKind } from "../GameLog";

/**
 * 先読み用の軽量なゲームエンジン。
 * 本物のCommandより簡略化している（カットインなし、ドボンは出された瞬間に全員が宣言する、
 * ドボン返しは条件を満たせば必ず成立する、山札切れは誰も点数が動かない）。
 */
export interface FastState {
  hands: CardKind[][];
  deck: CardKind[];
  top: CardKind;
  color: string;
  drawStack: number;
  turn: number;
  direction: number;
  // 結果（席ごとの得点の増減）。終わっていなければ undefined
  result?: number[];
}

export type FastAction =
  | { kind: "play"; cards: CardKind[] }
  | { kind: "draw" }
  | { kind: "drawStack" };

const COLORS = ["red", "blue", "green", "yellow"];
const SYMBOLS = new Set([
  "skip",
  "reverse",
  "draw2",
  "wild",
  "draw4",
  "force-change",
]);

export function cloneState(state: FastState): FastState {
  return {
    hands: state.hands.map((h) => h.slice()),
    deck: state.deck.slice(),
    top: state.top,
    color: state.color,
    drawStack: state.drawStack,
    turn: state.turn,
    direction: state.direction,
    result: state.result,
  };
}

export function handTotal(hand: CardKind[]): number {
  let sum = 0;
  for (const card of hand) sum += card.points;
  return sum;
}

export function isPlayable(state: FastState, card: CardKind): boolean {
  const hand = state.hands[state.turn];
  if (hand.length === 1 && SYMBOLS.has(card.value)) return false;
  if (state.drawStack > 0) {
    if (state.top.value === "draw2") {
      return card.value === "draw2" || card.value === "draw4";
    }
    return state.top.value === "draw4" && card.value === "draw4";
  }
  if (
    card.color === "wild" ||
    card.value === "force-change" ||
    state.color === ""
  ) {
    return true;
  }
  return card.color === state.color || card.value === state.top.value;
}

/** 手番の人がカードを出す（同じカードの重ね出しも可）。ドボン・上がりの判定までする */
export function play(state: FastState, cards: CardKind[]): void {
  const player = state.turn;
  const hand = state.hands[player];
  for (const card of cards) {
    const index = hand.indexOf(card);
    if (index >= 0) hand.splice(index, 1);
  }
  const last = cards[cards.length - 1];
  const played = handTotal(cards);
  state.top = last;

  if (last.color === "wild") {
    state.color = mostCommonColor(hand);
  } else {
    state.color = cards[0].color;
  }

  if (resolveDobon(state, player, played)) return;

  if (hand.length === 0) {
    // 普通の上がり: 全員が自分の手札の合計点を払う
    const result = state.hands.map(() => 0);
    state.hands.forEach((h, i) => {
      if (i === player) return;
      const total = handTotal(h);
      result[i] -= total;
      result[player] += total;
    });
    state.result = result;
    return;
  }

  const n = state.hands.length;
  let advance = 1;
  if (last.value === "skip") advance += 2 * cards.length - 1;
  if (last.value === "reverse" && cards.length % 2 === 1) {
    state.direction *= -1;
  }
  if (last.value === "draw2") state.drawStack += 2 * cards.length;
  if (last.value === "draw4") state.drawStack += 4 * cards.length;
  state.turn = (player + state.direction * advance + n * advance) % n;
  state.turn = ((state.turn % n) + n) % n;
}

/** 手番の人が山札から1枚引く。引けなければ山札切れで終わる */
export function drawOne(state: FastState): CardKind | undefined {
  const card = state.deck.pop();
  if (!card) {
    state.result = state.hands.map(() => 0);
    return undefined;
  }
  state.hands[state.turn].push(card);
  return card;
}

/** 累積ドローを引いて手番を渡す */
export function drawStack(state: FastState): void {
  for (let i = 0; i < state.drawStack; i++) {
    if (!drawOne(state)) return;
  }
  state.drawStack = 0;
  passTurn(state);
}

export function passTurn(state: FastState): void {
  const n = state.hands.length;
  state.turn = (((state.turn + state.direction) % n) + n) % n;
}

/**
 * 出されたカードの点数と手札合計が同じ人がいればドボンで終わらせる。
 * ドボンされた人の残りとドボンした人の合計が同じならドボン返し。
 */
function resolveDobon(
  state: FastState,
  player: number,
  played: number,
): boolean {
  const dobon: number[] = [];
  state.hands.forEach((hand, i) => {
    if (i !== player && handTotal(hand) === played) dobon.push(i);
  });
  if (dobon.length === 0) return false;

  let pot = played;
  for (const hand of state.hands) pot += handTotal(hand);
  const rest = handTotal(state.hands[player]);
  const returned = state.hands[player].length > 0 && rest === played;
  const result = state.hands.map(() => 0);
  for (const i of dobon) {
    const sign = returned ? -1 : 1;
    result[i] += sign * pot;
    result[player] -= sign * pot;
  }
  state.result = result;
  return true;
}

function mostCommonColor(hand: CardKind[]): string {
  const counts = new Map<string, number>();
  for (const card of hand) {
    if (card.color !== "wild") {
      counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
    }
  }
  let best = COLORS[0];
  let bestCount = -1;
  for (const color of COLORS) {
    const count = counts.get(color) ?? 0;
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
