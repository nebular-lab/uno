/**
 * サーバーからクライアントに送信されるアニメーションイベント
 */

export interface CardData {
  id: string;
  color: string;
  value: string;
  points: number;
}

/**
 * カードを出した時のアニメーションイベント
 */
export interface PlayCardAnimationEvent {
  type: "playCardAnimation";
  playerId: string; // カードを出したプレイヤーのsessionId
  seatId: number; // プレイヤーの座席番号（1-6）
  cards: CardData[]; // 出されたカード（複数枚対応）
  isCurrentTurn: boolean; // 手番プレイヤーかどうか（カットインの場合false）
  animationDuration: number; // アニメーション時間（ms）
}
