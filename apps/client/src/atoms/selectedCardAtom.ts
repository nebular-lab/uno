import { atom } from "jotai";

// 選択中のカードIDリスト（順番も保持）
export const selectedCardIdsAtom = atom<string[]>([]);

// 後方互換性のため、最初に選択したカードIDを取得するatom
export const selectedCardIdAtom = atom(
  (get) => get(selectedCardIdsAtom)[0] ?? null,
);
