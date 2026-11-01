import { atom } from "jotai";

// 選択中のカードIDリスト（順番も保持）
export const selectedCardIdsAtom = atom<string[]>([]);
