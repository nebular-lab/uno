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

/**
 * カードを引いた時のアニメーションイベント
 */
export interface DrawCardAnimationEvent {
  type: "drawCardAnimation";
  playerId: string; // カードを引いたプレイヤーのsessionId
  seatId: number; // 座席番号（1-6）
  cardCount: number; // 引いた枚数
  animationDuration: number; // アニメーション時間（ms）
}
