import { atom } from "jotai";

// 場札の画面上の位置とサイズを記録
export const fieldCardPositionAtom = atom<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);
