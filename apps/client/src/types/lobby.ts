import type { Room, RoomAvailable } from "@colyseus/sdk";
import type { RoomMetadata } from "@dobon-uno/shared";

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
