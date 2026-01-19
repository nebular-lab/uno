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
