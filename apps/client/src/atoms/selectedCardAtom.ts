import { atom } from "jotai";

// 選択中のカードID（null = 未選択）
export const selectedCardIdAtom = atom<string | null>(null);

// 選択中の重ね出し枚数（1 = 1枚出し、2 = 2枚出し...）
export const selectedStackCountAtom = atom<number>(1);
