import type { RoomAvailable } from "@colyseus/sdk";
import {
  gamePlayStateAtom,
  gameStateAtom,
  initialGamePlayState,
  setupRoomStateSync,
  viewpointSessionIdAtom,
} from "@dobon-uno/game-ui";
import type {
  CreateRoomOptions,
  GameState,
  JoinRoomOptions,
  RoomMetadata,
} from "@dobon-uno/shared";
import { atom } from "jotai";
import { colyseusClient } from "../lib/colyseus";
import type { LobbyState } from "../types/lobby";
import { playerAtom, screenAtom } from "./appAtoms";

// ロビー接続状態
export const lobbyStateAtom = atom<LobbyState>({ status: "idle" });

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

    // 切断ハンドリング（手動でleave()を呼んだ後にdisconnectedにならないよう、現在の状態をチェック）
    lobby.onLeave((code) => {
      set(lobbyStateAtom, (prev) => {
        // 既にidleや他の状態に変更されていたら何もしない
        if (prev.status !== "connected") return prev;
        if (code === 1000 || code === 4000) {
          return { status: "idle" };
        }
        return { status: "disconnected" };
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ロビーへの接続に失敗しました";
    set(lobbyStateAtom, { status: "error", error: message });
  }
});

// ロビーから切断
export const disconnectFromLobbyAtom = atom(null, (get, set) => {
  const state = get(lobbyStateAtom);
  if (state.status === "connected") {
    // 先にidleに設定してからleave()を呼ぶことで、onLeaveでdisconnectedにならないようにする
    set(lobbyStateAtom, { status: "idle" });
    // leave()はサーバーからの切断応答で解決するため、ソケットが切れていると永久に解決しない。
    // 待つと画面遷移が止まる（ロビーのスピナーのままになる）ので完了を待たない
    state.lobby.leave().catch(() => {});
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
    const options: CreateRoomOptions = { playerName: player.name };
    const room = await colyseusClient.create<GameState>("game", options);

    // GameRoom接続設定
    set(gameStateAtom, { status: "connected", room });

    // Room状態変更をatomに反映
    setupRoomStateSync(room, set, false);

    room.onLeave((code) => {
      if (code === 1000) {
        set(gameStateAtom, { status: "idle" });
        set(gamePlayStateAtom, initialGamePlayState);
      } else {
        set(gameStateAtom, { status: "disconnected" });
      }
    });

    // ロビーから切断して待機画面へ遷移
    set(disconnectFromLobbyAtom);
    set(screenAtom, { screen: "waitingRoom", roomId: room.roomId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ルームの作成に失敗しました";
    set(gameStateAtom, { status: "error", error: message });
  }
});

// ルームに参加（spectate: true なら観戦者として参加）
export const joinRoomAtom = atom(
  null,
  async (
    get,
    set,
    { roomId, spectate = false }: { roomId: string; spectate?: boolean },
  ) => {
    const player = get(playerAtom);
    if (!player) {
      set(gameStateAtom, {
        status: "error",
        error: "プレイヤー情報がありません",
      });
      return;
    }

    set(gameStateAtom, { status: "joining" });
    set(viewpointSessionIdAtom, "");

    try {
      const options: JoinRoomOptions = { playerName: player.name, spectate };
      const room = await colyseusClient.joinById<GameState>(roomId, options);

      // GameRoom接続設定
      set(gameStateAtom, { status: "connected", room });

      // Room状態変更をatomに反映
      setupRoomStateSync(room, set, spectate);

      room.onLeave((code) => {
        if (code === 1000) {
          set(gameStateAtom, { status: "idle" });
          set(gamePlayStateAtom, initialGamePlayState);
        } else {
          set(gameStateAtom, { status: "disconnected" });
        }
      });

      // ロビーから切断して待機画面（観戦はゲーム画面）へ遷移
      set(disconnectFromLobbyAtom);
      set(
        screenAtom,
        spectate
          ? { screen: "game", roomId: room.roomId }
          : { screen: "waitingRoom", roomId: room.roomId },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ルームへの参加に失敗しました";
      set(gameStateAtom, { status: "error", error: message });
    }
  },
);

// 切断状態をリセット
export const resetDisconnectedAtom = atom(null, (_get, set) => {
  set(lobbyStateAtom, { status: "idle" });
  set(gameStateAtom, { status: "idle" });
});
