/**
 * プレイヤーアクション型定義
 * サーバー → クライアント通信用
 */

// 共通の基底型
export interface BaseAction {
  playerId: string; // アクション実行プレイヤーのsessionId
  seatId: number; // 座席番号（アニメーション位置の特定用）
  playerName: string; // プレイヤー名（通知表示用）
  timestamp: number; // タイムスタンプ（ミリ秒）
}

// 1. カードを出す（重ね出し対応）
export type PlayCardAction = BaseAction & {
  type: "playCard";
  cardIds: string[]; // 複数カード対応
};

// 2. 山札を引く（常に1枚）
export type DrawAction = BaseAction & {
  type: "draw";
};

// 3. 累積カードを引く
export type DrawStackAction = BaseAction & {
  type: "drawStack";
  count: number; // 引いた累積枚数
};

// 4. パス
export type PassAction = BaseAction & {
  type: "pass";
};

// 5. ドボン
export type DobonAction = BaseAction & {
  type: "dobon";
};

// 6. ドボン返し
export type DobonReturnAction = BaseAction & {
  type: "dobonReturn";
};

// 7. 色を選択
export type ChooseColorAction = BaseAction & {
  type: "chooseColor";
  color: "red" | "blue" | "green" | "yellow";
};

// 8. ゲーム開始
export type GameStartAction = BaseAction & {
  type: "gameStart";
  gameNumber: number;
  startPlayerId: string;
  rateMultiplier: number;
};

// 9. ゲーム終了（サーバー→クライアントのみ）
export type GameEndAction = BaseAction & {
  type: "gameEnd";
  scoreChanges: Record<string, number>; // sessionId -> 得点変動
  rateMultiplier: number;
};

// 10. 山札切れ（サーバー→クライアントのみ）
export type DeckOutAction = BaseAction & {
  type: "deckOut";
  nextGameMultiplier: number; // 次ゲームのレート倍率（2^n倍）
};

// タグ付きユニオン型
export type PlayerAction =
  | PlayCardAction
  | DrawAction
  | DrawStackAction
  | PassAction
  | DobonAction
  | DobonReturnAction
  | ChooseColorAction
  | GameStartAction
  | GameEndAction
  | DeckOutAction;
