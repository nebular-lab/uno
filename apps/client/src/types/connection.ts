import type { GameState, RoomMetadata } from "@dobon-uno/shared";
import type { Room, RoomAvailable } from "colyseus.js";

// ロビー接続状態
export type LobbyState =
  | { status: "idle" }
  | { status: "connecting" }
  | {
      status: "connected";
      lobby: Room;
      rooms: RoomAvailable<RoomMetadata>[];
    }
  | { status: "error"; error: string }
  | { status: "disconnected" }; // 異常切断

// ゲームルーム接続状態
export type GameRoomState =
  | { status: "idle" }
  | { status: "joining" }
  | { status: "connected"; room: Room<GameState> }
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
  isSpectator: boolean;
  isCpu: boolean; // CPUプレイヤーかどうか
  timeRemaining: number; // タイマー残り秒数（0なら非アクティブ）
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
  timestamp: number;
  winnerId: string;
  finishType: string; // "normal" | "dobon" | "dobonReturn"
};

// ゲームプレイ状態（Room.stateをReact用に変換した状態）
export type GamePlayState = {
  // プレイヤー情報
  players: (ClientPlayer | null)[]; // 6人分の席配列
  mySessionId: string;
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

  // ドボン状態
  dobonPlayerIds: string[]; // ドボンしたプレイヤーのsessionIdリスト

  // ゲーム履歴
  gameHistory: ClientGameResult[];
};
