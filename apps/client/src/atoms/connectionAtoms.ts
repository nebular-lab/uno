import type {
  GameState,
  RoomMetadata,
  Card as ServerCard,
  Player as ServerPlayer,
} from "@dobon-uno/shared";
import type { Room, RoomAvailable } from "colyseus.js";
import { atom } from "jotai";
import { colyseusClient } from "../lib/colyseus";
import type {
  ClientCard,
  ClientPlayer,
  GamePlayState,
  GameRoomState,
  LobbyState,
} from "../types/connection";
import { playerAtom, screenAtom } from "./appAtoms";

// ロビー接続状態
export const lobbyStateAtom = atom<LobbyState>({ status: "idle" });

// ゲームルーム接続状態
export const gameStateAtom = atom<GameRoomState>({ status: "idle" });

// ゲームプレイ状態の初期値
const initialGamePlayState: GamePlayState = {
  players: [null, null, null, null, null, null],
  mySessionId: "",
  isReady: false,
  myHand: [],
  phase: "waiting",
  dealingRound: 0,
  countdown: 0,
  fieldCards: [],
  currentTurnPlayerId: "",
  currentColor: "",
  deckCount: 0,
};

// ゲームプレイ状態（Room.stateから変換）
export const gamePlayStateAtom = atom<GamePlayState>(initialGamePlayState);

// サーバーのCardをクライアント用に変換
const convertCard = (serverCard: ServerCard): ClientCard => ({
  id: serverCard.id,
  color: serverCard.color,
  value: serverCard.value,
  points: serverCard.points,
});

// サーバーのPlayerをクライアント用に変換
const convertPlayer = (serverPlayer: ServerPlayer): ClientPlayer => ({
  seatIndex: serverPlayer.seatId - 1,
  name: serverPlayer.name,
  cardCount: serverPlayer.handCount,
  isHost: serverPlayer.isOwner,
  isReady: serverPlayer.isReady,
  isSpectator: serverPlayer.isSpectator,
});

// 6人分の席配列を作成
const createSeatsArray = (
  players: Map<string, ServerPlayer>,
): (ClientPlayer | null)[] => {
  const seats: (ClientPlayer | null)[] = [null, null, null, null, null, null];
  for (const player of players.values()) {
    const seatIndex = player.seatId - 1;
    if (seatIndex >= 0 && seatIndex < 6) {
      seats[seatIndex] = convertPlayer(player);
    }
  }
  return seats;
};

// Room状態変更をatomに反映するヘルパー
const setupRoomStateSync = (
  room: Room<GameState>,
  set: (atom: typeof gamePlayStateAtom, value: GamePlayState) => void,
) => {
  const updatePlayState = (state: GameState) => {
    // stateの各プロパティが初期化されているかチェック
    const playersMap = new Map<string, ServerPlayer>();
    if (state.players) {
      state.players.forEach((player, sessionId) => {
        playersMap.set(sessionId, player);
      });
    }

    const myServerPlayer = state.players?.get(room.sessionId);

    set(gamePlayStateAtom, {
      players: createSeatsArray(playersMap),
      mySessionId: room.sessionId,
      isReady: myServerPlayer?.isReady ?? false,
      myHand: myServerPlayer?.myHand
        ? Array.from(myServerPlayer.myHand).map(convertCard)
        : [],
      phase: state.phase ?? "waiting",
      dealingRound: state.dealingRound ?? 0,
      countdown: state.countdown ?? 0,
      fieldCards: state.fieldCards
        ? Array.from(state.fieldCards).map(convertCard)
        : [],
      currentTurnPlayerId: state.currentTurnPlayerId ?? "",
      currentColor: state.currentColor ?? "",
      deckCount: state.deckCount ?? 0,
    });
  };

  // 初期状態を設定
  updatePlayState(room.state);

  // 状態変更を購読
  room.onStateChange(updatePlayState);
};

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

    // Room状態変更をatomに反映
    setupRoomStateSync(room, set);

    room.onLeave((code) => {
      if (code === 1000) {
        set(gameStateAtom, { status: "idle" });
        set(gamePlayStateAtom, initialGamePlayState);
      } else {
        set(gameStateAtom, { status: "disconnected" });
      }
    });

    // ロビーから切断して待機画面へ遷移
    const lobbyState = get(lobbyStateAtom);
    if (lobbyState.status === "connected") {
      await lobbyState.lobby.leave();
      set(lobbyStateAtom, { status: "idle" });
    }
    set(screenAtom, { screen: "waitingRoom", roomId: room.roomId });
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

    // Room状態変更をatomに反映
    setupRoomStateSync(room, set);

    room.onLeave((code) => {
      if (code === 1000) {
        set(gameStateAtom, { status: "idle" });
        set(gamePlayStateAtom, initialGamePlayState);
      } else {
        set(gameStateAtom, { status: "disconnected" });
      }
    });

    // ロビーから切断して待機画面へ遷移
    const lobbyState = get(lobbyStateAtom);
    if (lobbyState.status === "connected") {
      await lobbyState.lobby.leave();
      set(lobbyStateAtom, { status: "idle" });
    }
    set(screenAtom, { screen: "waitingRoom", roomId: room.roomId });
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
