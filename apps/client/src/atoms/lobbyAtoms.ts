import type { GameState, RoomListingData } from "@dobon-uno/shared";
import type { Room } from "colyseus.js";
import { atom } from "jotai";
import { colyseusClient } from "../lib/colyseus";
import { playerAtom, screenAtom } from "./appAtoms";

// ルーム一覧
export const roomsAtom = atom<RoomListingData[]>([]);

// LobbyRoom接続
export const lobbyRoomAtom = atom<Room | null>(null);

// GameRoom接続
export const gameRoomAtom = atom<Room<GameState> | null>(null);

// ローディング状態
export const lobbyLoadingAtom = atom(false);

// エラー状態
export const lobbyErrorAtom = atom<string | null>(null);

// ロビーに接続
export const connectToLobbyAtom = atom(null, async (_get, set) => {
  set(lobbyLoadingAtom, true);
  set(lobbyErrorAtom, null);

  try {
    const lobby = await colyseusClient.joinOrCreate("lobby");
    set(lobbyRoomAtom, lobby);

    // 全ルーム受信
    lobby.onMessage("rooms", (rooms: RoomListingData[]) => {
      set(roomsAtom, rooms);
    });

    // ルーム追加
    lobby.onMessage("+", ([roomId, room]: [string, RoomListingData]) => {
      set(roomsAtom, (prev) => {
        const exists = prev.some((r) => r.roomId === roomId);
        if (exists) {
          return prev.map((r) =>
            r.roomId === roomId ? { ...room, roomId } : r,
          );
        }
        return [...prev, { ...room, roomId }];
      });
    });

    // ルーム削除
    lobby.onMessage("-", (roomId: string) => {
      set(roomsAtom, (prev) => prev.filter((r) => r.roomId !== roomId));
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ロビーへの接続に失敗しました";
    set(lobbyErrorAtom, message);
  } finally {
    set(lobbyLoadingAtom, false);
  }
});

// ロビーから切断
export const disconnectFromLobbyAtom = atom(null, async (get, set) => {
  const lobby = get(lobbyRoomAtom);
  if (lobby) {
    await lobby.leave();
    set(lobbyRoomAtom, null);
    set(roomsAtom, []);
  }
});

// ルームを作成
export const createRoomAtom = atom(null, async (get, set) => {
  const player = get(playerAtom);
  if (!player) {
    set(lobbyErrorAtom, "プレイヤー情報がありません");
    return;
  }

  set(lobbyLoadingAtom, true);
  set(lobbyErrorAtom, null);

  try {
    const room = await colyseusClient.create<GameState>("game", {
      playerName: player.name,
    });

    set(gameRoomAtom, room);

    // ロビーから切断
    const lobby = get(lobbyRoomAtom);
    if (lobby) {
      await lobby.leave();
      set(lobbyRoomAtom, null);
    }

    // ゲーム画面へ遷移
    set(screenAtom, { screen: "game", roomId: room.roomId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ルームの作成に失敗しました";
    set(lobbyErrorAtom, message);
  } finally {
    set(lobbyLoadingAtom, false);
  }
});

// ルームに参加
export const joinRoomAtom = atom(null, async (get, set, roomId: string) => {
  const player = get(playerAtom);
  if (!player) {
    set(lobbyErrorAtom, "プレイヤー情報がありません");
    return;
  }

  set(lobbyLoadingAtom, true);
  set(lobbyErrorAtom, null);

  try {
    const room = await colyseusClient.joinById<GameState>(roomId, {
      playerName: player.name,
    });

    set(gameRoomAtom, room);

    // ロビーから切断
    const lobby = get(lobbyRoomAtom);
    if (lobby) {
      await lobby.leave();
      set(lobbyRoomAtom, null);
    }

    // ゲーム画面へ遷移
    set(screenAtom, { screen: "game", roomId: room.roomId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ルームへの参加に失敗しました";
    set(lobbyErrorAtom, message);
  } finally {
    set(lobbyLoadingAtom, false);
  }
});
