import { atom } from "jotai";
import type { ClientCard } from "../types/connection";
import { sortCards } from "../utils/cardSort";
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

  // ローカル順序がないカード（引いたカード）は末尾に追加
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

// 手札の変化に合わせて並び順を同期するアクション
// - カードが減った（切った）とき、または新しく配られたときは全体を並び替える
// - カードが増えただけ（引いた）のときは並び順を保ち、右端に追加する
export const syncHandOrderAtom = atom(null, (get, set) => {
  const { myHand } = get(gamePlayStateAtom);
  const localOrder = get(localHandOrderAtom);
  if (myHand.length === 0) return;

  const handIds = new Set(myHand.map((card) => card.id));
  const hasRemovedCard = [...localOrder.keys()].some((id) => !handIds.has(id));
  const isNewHand = !myHand.some((card) => localOrder.has(card.id));
  if (!hasRemovedCard && !isNewHand) return;

  const orderMap = new Map<string, number>();
  sortCards(myHand).forEach((card, index) => {
    orderMap.set(card.id, index);
  });
  set(localHandOrderAtom, orderMap);
});
