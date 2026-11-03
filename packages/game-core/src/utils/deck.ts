import { CARD_DECK_CONFIG, CARD_POINTS, Card } from "@dobon-uno/shared";

const COLORS = ["red", "blue", "green", "yellow"] as const;

/**
 * 山札を生成する（112枚）
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  let cardIndex = 0;

  // 数字カード（76枚）
  for (const color of COLORS) {
    for (const [value, count] of Object.entries(CARD_DECK_CONFIG.numbers)) {
      for (let i = 0; i < count; i++) {
        const id = `${color[0]}${value}-${++cardIndex}`;
        deck.push(new Card(id, color, value, CARD_POINTS[value]));
      }
    }
  }

  // 記号カード（24枚）
  for (const color of COLORS) {
    for (const [symbol, count] of Object.entries(CARD_DECK_CONFIG.actions)) {
      for (let i = 0; i < count; i++) {
        const id = `${color[0]}-${symbol}-${++cardIndex}`;
        deck.push(new Card(id, color, symbol, CARD_POINTS[symbol]));
      }
    }
  }

  // ワイルドカード（4枚）
  for (let i = 1; i <= CARD_DECK_CONFIG.wild; i++) {
    const id = `wild-${i}`;
    deck.push(new Card(id, "wild", "wild", CARD_POINTS.wild));
  }

  // ドロー4（4枚）
  for (let i = 1; i <= CARD_DECK_CONFIG.draw4; i++) {
    const id = `draw4-${i}`;
    deck.push(new Card(id, "wild", "draw4", CARD_POINTS.draw4));
  }

  // 強制色変えカード（4枚）
  for (const color of COLORS) {
    const id = `force-${color}`;
    deck.push(new Card(id, color, "force-change", CARD_POINTS["force-change"]));
  }

  return deck;
}

/**
 * シード付き疑似乱数生成器（Mulberry32）
 * 同じseedなら常に同じ乱数列を生成する
 */
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

/**
 * 山札をシャッフルする（Fisher-Yates）
 * @param deck シャッフルする山札
 * @param seed シード値（指定すると同じseedで同じ結果を返す）
 */
export function shuffleDeck(deck: Card[], seed?: number): Card[] {
  const random = seed !== undefined ? mulberry32(seed) : Math.random;
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
