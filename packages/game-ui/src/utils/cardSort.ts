import { sortCards as sortCardsShared } from "@dobon-uno/shared";
import type { ClientCard } from "../types/connection";

// 並び順は @dobon-uno/shared の compareCards（サーバーの配り順と同じ）
export function sortCards(cards: ClientCard[]): ClientCard[] {
  return sortCardsShared(cards);
}
