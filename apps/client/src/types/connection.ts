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
  seatIndex: number;
  name: string;
  cardCount: number;
  isHost: boolean;
  isReady: boolean;
};

// ゲームプレイ状態（Room.stateをReact用に変換した状態）
export type GamePlayState = {
  // プレイヤー情報
  players: (ClientPlayer | null)[]; // 6人分の席配列
  mySessionId: string;
  isReady: boolean;
  myHand: ClientCard[];

  // ゲーム進行状態
  phase: string;
  dealingRound: number;
  countdown: number;
  fieldCards: ClientCard[];
  currentTurnPlayerId: string;
  currentColor: string;
  deckCount: number;
};
