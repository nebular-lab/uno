import type { GameState, RoomMetadata } from "@dobon-uno/shared";
import type { RoomAvailable } from "colyseus.js";
import { atom } from "jotai";
import { colyseusClient } from "../lib/colyseus";
import type { GameRoomState, LobbyState } from "../types/connection";
import { playerAtom, screenAtom } from "./appAtoms";

// ロビー接続状態
export const lobbyStateAtom = atom<LobbyState>({ status: "idle" });

// ゲームルーム接続状態
export const gameStateAtom = atom<GameRoomState>({ status: "idle" });

// ロビーに接続
export const connectToLobbyAtom = atom(null, async (get, set) => {
  const currentState = get(lobbyStateAtom);
  if (
    currentState.status === "connecting" ||
    currentState.status === "connected"
  ) {
    return;
  }

  set(lobbyStateAtom, { status: "connecting" });

  try {
    const lobby = await colyseusClient.joinOrCreate<GameState>("lobby");

    set(lobbyStateAtom, {
      status: "connected",
      lobby,
      rooms: [],
    });

    // 全ルーム受信
    lobby.onMessage<RoomAvailable<RoomMetadata>[]>("rooms", (rooms) => {
      set(lobbyStateAtom, (prev) =>
        prev.status === "connected" ? { ...prev, rooms } : prev,
      );
    });

    // ルーム追加
    lobby.onMessage<[string, RoomAvailable<RoomMetadata>]>(
      "+",
      ([roomId, room]) => {
        set(lobbyStateAtom, (prev) => {
          if (prev.status !== "connected") return prev;
          const exists = prev.rooms.some((r) => r.roomId === roomId);
          if (exists) {
            return {
              ...prev,
              rooms: prev.rooms.map((r) =>
                r.roomId === roomId ? { ...room, roomId } : r,
              ),
            };
          }
          return { ...prev, rooms: [...prev.rooms, { ...room, roomId }] };
        });
      },
    );

    // ルーム削除
    lobby.onMessage<string>("-", (roomId) => {
      set(lobbyStateAtom, (prev) =>
        prev.status === "connected"
          ? { ...prev, rooms: prev.rooms.filter((r) => r.roomId !== roomId) }
          : prev,
      );
    });

    // 切断ハンドリング
    lobby.onLeave((code) => {
      if (code === 1000 || code === 4000) {
        set(lobbyStateAtom, { status: "idle" });
      } else {
        set(lobbyStateAtom, { status: "disconnected" });
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ロビーへの接続に失敗しました";
    set(lobbyStateAtom, { status: "error", error: message });
  }
});

// ロビーから切断
export const disconnectFromLobbyAtom = atom(null, async (get, set) => {
  const state = get(lobbyStateAtom);
  if (state.status === "connected") {
    await state.lobby.leave();
    set(lobbyStateAtom, { status: "idle" });
  }
});

// ルームを作成
export const createRoomAtom = atom(null, async (get, set) => {
  const player = get(playerAtom);
  if (!player) {
    set(gameStateAtom, {
      status: "error",
      error: "プレイヤー情報がありません",
    });
    return;
  }

  set(gameStateAtom, { status: "joining" });

  try {
    const room = await colyseusClient.create<GameState>("game", {
      playerName: player.name,
    });

    // GameRoom接続設定
    set(gameStateAtom, { status: "connected", room });
    room.onLeave((code) => {
      if (code === 1000) {
        set(gameStateAtom, { status: "idle" });
      } else {
        set(gameStateAtom, { status: "disconnected" });
      }
    });

    // ロビーから切断してゲーム画面へ遷移
    const lobbyState = get(lobbyStateAtom);
    if (lobbyState.status === "connected") {
      await lobbyState.lobby.leave();
      set(lobbyStateAtom, { status: "idle" });
    }
    set(screenAtom, { screen: "game", roomId: room.roomId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ルームの作成に失敗しました";
    set(gameStateAtom, { status: "error", error: message });
  }
});

// ルームに参加
export const joinRoomAtom = atom(null, async (get, set, roomId: string) => {
  const player = get(playerAtom);
  if (!player) {
    set(gameStateAtom, {
      status: "error",
      error: "プレイヤー情報がありません",
    });
    return;
  }

  set(gameStateAtom, { status: "joining" });

  try {
    const room = await colyseusClient.joinById<GameState>(roomId, {
      playerName: player.name,
    });

    // GameRoom接続設定
    set(gameStateAtom, { status: "connected", room });
    room.onLeave((code) => {
      if (code === 1000) {
        set(gameStateAtom, { status: "idle" });
      } else {
        set(gameStateAtom, { status: "disconnected" });
      }
    });

    // ロビーから切断してゲーム画面へ遷移
    const lobbyState = get(lobbyStateAtom);
    if (lobbyState.status === "connected") {
      await lobbyState.lobby.leave();
      set(lobbyStateAtom, { status: "idle" });
    }
    set(screenAtom, { screen: "game", roomId: room.roomId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ルームへの参加に失敗しました";
    set(gameStateAtom, { status: "error", error: message });
  }
});

// 切断状態をリセット
export const resetDisconnectedAtom = atom(null, (_get, set) => {
  set(lobbyStateAtom, { status: "idle" });
  set(gameStateAtom, { status: "idle" });
});
