import type { GameState } from "@dobon-uno/shared";

// ゲームルーム（ColyseusのRoom、またはブラウザ内で動くシングルプレイのルーム）
// 画面が使う機能だけを持つ
export interface GameRoomLike {
  readonly roomId: string;
  readonly sessionId: string;
  readonly state: GameState;
  send(type: string, message?: unknown): void;
  onStateChange: {
    (callback: (state: GameState) => void): unknown;
    remove(callback: (state: GameState) => void): void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: メッセージの型は種類ごとに呼び出し側で指定する
  onMessage<T = any>(type: string, callback: (message: T) => void): unknown;
  onLeave(callback: (code: number) => void): unknown;
}

// ゲームルーム接続状態
export type GameRoomState =
  | { status: "idle" }
  | { status: "joining" }
  | { status: "connected"; room: GameRoomLike }
  | { status: "error"; error: string }
  | { status: "disconnected" }; // 異常切断

// クライアント用のカード型
export type ClientCard = {
  id: string;
  color: string;
  value: string;
  points: number;
};

// クライアント用のプレイヤー型
export type ClientPlayer = {
  sessionId: string;
  seatIndex: number;
  name: string;
  cardCount: number;
  isHost: boolean;
  isCpu: boolean; // CPUプレイヤーかどうか
  timeRemaining: number; // タイマー残り秒数（0なら非アクティブ）
  revealedHand: ClientCard[]; // 公開された手札（上がり・ドボン・ドボン返し時）
  // アクションフラグ
  canPass: boolean;
  canDraw: boolean;
  canChooseColor: boolean;
  canDobon: boolean;
  canDobonReturn: boolean;
  canDrawStack: boolean;
  playableCards: Record<string, boolean>; // cardId -> 出せるか
};

// クライアント用のゲーム結果型
export type ClientGameResult = {
  gameNumber: number;
  scoreChanges: Record<string, number>; // sessionId -> 得点変動
  handPoints: Record<string, number>; // sessionId -> 終了時の手札合計点数
  playerNames: Record<string, string>; // sessionId -> プレイヤー名
  timestamp: number;
  winnerId: string;
  finishType: string; // "normal" | "dobon" | "dobonReturn" | "deckOut"（流局）
  rateMultiplier: number; // このゲームのレート倍率
};

// ゲームプレイ状態（Room.stateをReact用に変換した状態）
export type GamePlayState = {
  // プレイヤー情報
  players: (ClientPlayer | null)[]; // 6人分の席配列
  mySessionId: string; // 観戦時は視点に選んだプレイヤーのsessionId
  isSpectator: boolean; // 観戦者として参加しているか
  spectatorCount: number;
  isSinglePlay: boolean; // シングルプレイ（CPU4人と対戦）のルームか
  myHand: ClientCard[];

  // ゲーム進行状態
  phase: string;
  dealingRound: number;
  countdown: number;
  fieldCards: ClientCard[];
  lastPlayedCount: number; // 最後に出されたカードの枚数（重ね出し表示用）
  currentTurnPlayerId: string;
  currentColor: string;
  deckCount: number;
  drawStack: number; // ドロー累積枚数
  turnDirection: number; // 1=時計回り, -1=反時計回り
  rateMultiplier: number; // 次（または現在）のゲームのレート倍率

  // ドボン状態
  dobonPlayerIds: string[]; // ドボンしたプレイヤーのsessionIdリスト

  // ホスト設定
  showTotalPoints: boolean;
  highlightPlayableCards: boolean;
  cpuThinkingTime: number; // CPUの思考時間（ms）

  // ゲーム履歴
  gameHistory: ClientGameResult[];
};
