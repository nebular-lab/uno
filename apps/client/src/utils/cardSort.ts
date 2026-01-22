import type { ClientCard } from "@/types/connection";

const COLOR_ORDER: Record<string, number> = {
  red: 0,
  green: 1,
  blue: 2,
  yellow: 3,
  wild: 4,
};

// カテゴリ: 0=数字, 1=記号, 2=特殊
function getCategory(value: string): number {
  if (/^[0-9]$/.test(value)) return 0; // 数字
  if (value === "skip" || value === "reverse" || value === "draw2") return 1; // 記号
  return 2; // 特殊（force-change, wild, draw4）
}

const VALUE_ORDER: Record<string, number> = {
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
  skip: 10,
  reverse: 11,
  draw2: 12,
  "force-change": 13,
  wild: 14,
  draw4: 15,
};

export function compareCards(a: ClientCard, b: ClientCard): number {
  // カテゴリ優先（数字→記号→特殊）
  const catA = getCategory(a.value);
  const catB = getCategory(b.value);
  if (catA !== catB) return catA - catB;

  // 同カテゴリ内で色順
  const colorA = COLOR_ORDER[a.color] ?? 999;
  const colorB = COLOR_ORDER[b.color] ?? 999;
  if (colorA !== colorB) return colorA - colorB;

  // 同色内で値順
  const valueA = VALUE_ORDER[a.value] ?? 999;
  const valueB = VALUE_ORDER[b.value] ?? 999;
  return valueA - valueB;
}

export function sortCards(cards: ClientCard[]): ClientCard[] {
  return [...cards].sort(compareCards);
}
