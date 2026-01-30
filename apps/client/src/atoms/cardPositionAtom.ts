import { atom } from "jotai";

// 手札カードの画面上の位置を記録
export const cardPositionsAtom = atom<Record<string, { x: number; y: number }>>(
  {},
);

// 位置を更新するアクション
export const setCardPositionAtom = atom(
  null,
  (get, set, { cardId, x, y }: { cardId: string; x: number; y: number }) => {
    const current = get(cardPositionsAtom);
    set(cardPositionsAtom, { ...current, [cardId]: { x, y } });
  },
);

// カード位置をクリアするアクション
export const clearCardPositionsAtom = atom(null, (_get, set) => {
  set(cardPositionsAtom, {});
});

// 場札の画面上の位置を記録
export const fieldCardPositionAtom = atom<{ x: number; y: number } | null>(
  null,
);

// プレイヤーシートの位置を記録（displayIndex -> 位置）
export const playerSeatPositionsAtom = atom<
  Record<number, { x: number; y: number }>
>({});
