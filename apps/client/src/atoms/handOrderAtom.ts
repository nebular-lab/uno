import { atom } from "jotai";
import type { ClientCard } from "../types/connection";
import { gamePlayStateAtom } from "./connectionAtoms";

// カードIDから順序インデックスへのマッピング
type HandOrder = Map<string, number>;

// ローカルの手札並び順を保持
export const localHandOrderAtom = atom<HandOrder>(new Map());

// サーバーの手札とローカル順序をマージした派生atom
export const orderedMyHandAtom = atom<ClientCard[]>((get) => {
  const { myHand } = get(gamePlayStateAtom);
  const localOrder = get(localHandOrderAtom);

  if (myHand.length === 0) return [];

  // ローカル順序がないカードは末尾に追加
  const orderedCards = [...myHand].sort((a, b) => {
    const orderA = localOrder.get(a.id);
    const orderB = localOrder.get(b.id);

    // 両方に順序がある場合は順序で比較
    if (orderA !== undefined && orderB !== undefined) {
      return orderA - orderB;
    }
    // 片方だけ順序がある場合、順序があるものを前に
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;
    // 両方ない場合は元の順序を維持
    return 0;
  });

  return orderedCards;
});

// 手札の並び順を更新するアクション
export const updateHandOrderAtom = atom(
  null,
  (_get, set, newOrder: ClientCard[]) => {
    const orderMap = new Map<string, number>();
    newOrder.forEach((card, index) => {
      orderMap.set(card.id, index);
    });
    set(localHandOrderAtom, orderMap);
  },
);
