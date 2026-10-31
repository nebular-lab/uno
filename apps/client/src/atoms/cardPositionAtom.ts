import { atom } from "jotai";

// 場札の画面上の位置とサイズを記録
export const fieldCardPositionAtom = atom<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);

// 山札の画面上の位置とサイズを記録
export const deckPositionAtom = atom<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);

// プレイヤーシートの位置を記録（displayIndex -> 位置）
export const playerSeatPositionsAtom = atom<
  Record<number, { x: number; y: number }>
>({});
