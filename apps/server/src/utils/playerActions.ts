import type { Card, GameState, Player } from "@dobon-uno/shared";

/**
 * 次のプレイヤーに手番を進める
 */
export function advanceToNextPlayer(state: GameState): void {
  const sortedBySeat = getPlayersSortedBySeat(state);
  const currentIndex = sortedBySeat.findIndex(
    (p) => p.sessionId === state.currentTurnPlayerId,
  );
  const direction = state.turnDirection;
  const nextIndex =
    (currentIndex + direction + sortedBySeat.length) % sortedBySeat.length;
  state.currentTurnPlayerId = sortedBySeat[nextIndex].sessionId;
}

/**
 * プレイヤーを座席順でソートして取得
 */
export function getPlayersSortedBySeat(state: GameState): Player[] {
  return Array.from(state.players.values()).sort(
    (a, b) => a.seatId - b.seatId,
  );
}

/**
 * 記号カードかどうかを判定する
 * 記号カード: skip, reverse, draw2, wild, draw4, force-change
 */
export function isSymbolCard(card: Card): boolean {
  const symbolValues = [
    "skip",
    "reverse",
    "draw2",
    "wild",
    "draw4",
    "force-change",
  ];
  return symbolValues.includes(card.value);
}

/**
 * ドボンできるかどうかを判定する
 * 場のカードの点数と手札の合計点数が一致すればドボン可能
 */
export function canDobon(player: Player, fieldCard: Card): boolean {
  let handTotal = 0;
  for (const card of player.myHand) {
    handTotal += card.points;
  }
  return handTotal === fieldCard.points;
}
