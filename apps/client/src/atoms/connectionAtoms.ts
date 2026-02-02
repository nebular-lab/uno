import type {
  GameState,
  PlayCardAnimationEvent,
  RoomMetadata,
  Card as ServerCard,
  Player as ServerPlayer,
} from "@dobon-uno/shared";
import type { Room, RoomAvailable } from "colyseus.js";
import { atom, getDefaultStore } from "jotai";
import { colyseusClient } from "../lib/colyseus";
import type {
  ClientCard,
  ClientPlayer,
  GamePlayState,
  GameRoomState,
  LobbyState,
} from "../types/connection";
import { type CardAnimation, currentAnimationAtom } from "./animationAtoms";
import { playerAtom, screenAtom } from "./appAtoms";
import { cardPositionsAtom, playerSeatPositionsAtom } from "./cardPositionAtom";

// Jotaiのデフォルトストア（アニメーション用）
const store = getDefaultStore();

// ロビー接続状態
export const lobbyStateAtom = atom<LobbyState>({ status: "idle" });

// ゲームルーム接続状態
export const gameStateAtom = atom<GameRoomState>({ status: "idle" });

// ゲームプレイ状態の初期値
const initialGamePlayState: GamePlayState = {
  players: [null, null, null, null, null, null],
  mySessionId: "",
  myHand: [],
  phase: "waiting",
  dealingRound: 0,
  countdown: 0,
  fieldCards: [],
  lastPlayedCount: 1,
  currentTurnPlayerId: "",
  currentColor: "",
  deckCount: 0,
  drawStack: 0,
  turnDirection: 1,
  gameHistory: [],
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
const convertPlayer = (serverPlayer: ServerPlayer): ClientPlayer => {
  // playableCardsをRecord<string, boolean>に変換
  const playableCards: Record<string, boolean> = {};
  if (serverPlayer.playableCards) {
    serverPlayer.playableCards.forEach((value, key) => {
      playableCards[key] = value;
    });
  }

  return {
    sessionId: serverPlayer.sessionId,
    seatIndex: serverPlayer.seatId - 1,
    name: serverPlayer.name,
    cardCount: serverPlayer.handCount,
    isHost: serverPlayer.isOwner,
    isSpectator: serverPlayer.isSpectator,
    timeRemaining: serverPlayer.timeRemaining,
    // アクションフラグ
    canPass: serverPlayer.canPass,
    canDraw: serverPlayer.canDraw,
    canChooseColor: serverPlayer.canChooseColor,
    canDobon: serverPlayer.canDobon,
    canDobonReturn: serverPlayer.canDobonReturn,
    canDrawStack: serverPlayer.canDrawStack,
    playableCards,
  };
};

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

    // gameHistoryを変換
    const gameHistory = state.gameHistory
      ? Array.from(state.gameHistory).map((result) => {
          const scoreChanges: Record<string, number> = {};
          result.scoreChanges?.forEach((value, key) => {
            scoreChanges[key] = value;
          });
          return {
            gameNumber: result.gameNumber,
            scoreChanges,
            timestamp: result.timestamp,
            winnerId: result.winnerId,
            finishType: result.finishType,
          };
        })
      : [];

    set(gamePlayStateAtom, {
      players: createSeatsArray(playersMap),
      mySessionId: room.sessionId,
      myHand: myServerPlayer?.myHand
        ? Array.from(myServerPlayer.myHand).map(convertCard)
        : [],
      phase: state.phase ?? "waiting",
      dealingRound: state.dealingRound ?? 0,
      countdown: state.countdown ?? 0,
      fieldCards: state.fieldCards
        ? Array.from(state.fieldCards).map(convertCard)
        : [],
      lastPlayedCount: state.lastPlayedCount ?? 1,
      currentTurnPlayerId: state.currentTurnPlayerId ?? "",
      currentColor: state.currentColor ?? "",
      deckCount: state.deckCount ?? 0,
      drawStack: state.drawStack ?? 0,
      turnDirection: state.turnDirection ?? 1,
      gameHistory,
    });
  };

  // 初期状態を設定
  updatePlayState(room.state);

  // 状態変更を購読
  room.onStateChange(updatePlayState);

  // アニメーションイベントを購読
  room.onMessage("playCardAnimation", (event: PlayCardAnimationEvent) => {
    const isSelf = event.playerId === room.sessionId;

    // 開始位置とサイズをスナップショット（カードが削除される前に取得）
    let startPosition: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;
    if (isSelf && event.cards.length > 0) {
      const cardPositions = store.get(cardPositionsAtom);
      const firstCardPos = cardPositions[event.cards[0].id];
      if (firstCardPos) {
        startPosition = { ...firstCardPos };
      }
    } else {
      // 他プレイヤーの場合はシート位置を使用
      // mySeatIndexを計算してdisplayIndexを求める
      const gamePlayState = store.get(gamePlayStateAtom);
      const mySeatIndex = gamePlayState.players.findIndex(
        (p) => p !== null && p.sessionId === room.sessionId,
      );
      const seatIndex = event.seatId - 1;
      const displayIndex =
        mySeatIndex === -1 ? seatIndex : (seatIndex - mySeatIndex + 3 + 6) % 6;
      const seatPositions = store.get(playerSeatPositionsAtom);
      const seatPos = seatPositions[displayIndex];
      if (seatPos) {
        // 他プレイヤーの場合はデフォルトのカードサイズを使用
        startPosition = { ...seatPos, width: 40, height: 56 };
      }
    }

    const animation: CardAnimation = {
      id: `play-${Date.now()}`,
      type: "playCard",
      playerId: event.playerId,
      seatId: event.seatId,
      cards: event.cards.map((c) => ({
        id: c.id,
        color: c.color,
        value: c.value,
        points: c.points,
      })),
      isSelf,
      startTime: Date.now(),
      duration: event.animationDuration,
      startPosition,
    };

    // アニメーション用はデフォルトストアを使用
    store.set(currentAnimationAtom, animation);

    // アニメーション完了後にクリア
    setTimeout(() => {
      store.set(currentAnimationAtom, null);
    }, event.animationDuration);
  });
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
export const disconnectFromLobbyAtom = atom(null, async (get, set) => {
  const state = get(lobbyStateAtom);
  if (state.status === "connected") {
    // 先にidleに設定してからleave()を呼ぶことで、onLeaveでdisconnectedにならないようにする
    set(lobbyStateAtom, { status: "idle" });
    await state.lobby.leave();
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
    // 先にidleに設定してからleave()を呼ぶことで、onLeaveでdisconnectedにならないようにする
    const lobbyState = get(lobbyStateAtom);
    if (lobbyState.status === "connected") {
      set(lobbyStateAtom, { status: "idle" });
      await lobbyState.lobby.leave();
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
    // 先にidleに設定してからleave()を呼ぶことで、onLeaveでdisconnectedにならないようにする
    const lobbyState = get(lobbyStateAtom);
    if (lobbyState.status === "connected") {
      set(lobbyStateAtom, { status: "idle" });
      await lobbyState.lobby.leave();
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
