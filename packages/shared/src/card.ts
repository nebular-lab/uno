/**
 * カード関連の定数
 */

// カードの色
export type CardColor = "red" | "blue" | "green" | "yellow" | "wild";

// カードの値
export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "draw4"
  | "force-change";

// カードの点数
export const CARD_POINTS: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  skip: 20,
  reverse: 20,
  draw2: 20,
  wild: 30,
  draw4: 50,
  "force-change": 10,
};

// カード構成
export const CARD_DECK_CONFIG = {
  // 数字カード：0は各色1枚、1-9は各色2枚
  numbers: {
    "0": 1,
    "1": 2,
    "2": 2,
    "3": 2,
    "4": 2,
    "5": 2,
    "6": 2,
    "7": 2,
    "8": 2,
    "9": 2,
  },
  // 記号カード：各色2枚ずつ
  actions: {
    skip: 2,
    reverse: 2,
    draw2: 2,
  },
  // ワイルドカード
  wild: 4,
  draw4: 4,
  // 強制色変えカード：各色1枚
  forceChange: 1,
};

// カードID命名規則
// 数字カード: {color}{number} 例: "r5", "b3"
// 記号カード: {color}-{symbol} 例: "r-skip", "g-reverse"
// ワイルド: wild-{index} 例: "wild-1", "wild-2"
// ドロー4: draw4-{index} 例: "draw4-1", "draw4-2"
// 強制色変え: force-{color} 例: "force-red", "force-blue"
