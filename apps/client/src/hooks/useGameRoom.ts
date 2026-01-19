import type { GameState, Player as ServerPlayer } from "@dobon-uno/shared";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { navigateToLobbyAtom, playerAtom } from "../atoms/appAtoms";
import { gameStateAtom } from "../atoms/connectionAtoms";
import type { Player } from "../components/game/PlayerSeat";

// サーバーのPlayerをクライアント用のPlayer型に変換
const convertPlayer = (serverPlayer: ServerPlayer): Player => ({
  seatIndex: serverPlayer.seatId - 1, // seatIdは1始まり、seatIndexは0始まり
  name: serverPlayer.name,
  cardCount: serverPlayer.handCount,
  isHost: serverPlayer.isOwner,
  isReady: serverPlayer.isReady,
});

// 6人分の席配列を作成（nullは空席）
const createSeatsArray = (
  players: Map<string, ServerPlayer>,
): (Player | null)[] => {
  const seats: (Player | null)[] = [null, null, null, null, null, null];

  for (const player of players.values()) {
    const seatIndex = player.seatId - 1;
    if (seatIndex >= 0 && seatIndex < 6) {
      seats[seatIndex] = convertPlayer(player);
    }
  }

  return seats;
};

export const useGameRoom = () => {
  const gameRoomState = useAtomValue(gameStateAtom);
  const myPlayer = useAtomValue(playerAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);

  const [players, setPlayers] = useState<(Player | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // ルーム状態の購読
  useEffect(() => {
    if (gameRoomState.status !== "connected") return;

    const room = gameRoomState.room;
    setMySessionId(room.sessionId);

    // 初期状態を設定
    const updatePlayers = (state: GameState) => {
      const playersMap = new Map<string, ServerPlayer>();
      state.players.forEach((player, sessionId) => {
        playersMap.set(sessionId, player);
      });
      setPlayers(createSeatsArray(playersMap));

      // 自分のReady状態を更新
      const myServerPlayer = state.players.get(room.sessionId);
      if (myServerPlayer) {
        setIsReady(myServerPlayer.isReady);
      }
    };

    // 初期状態
    updatePlayers(room.state);

    // 状態変更を購読
    room.onStateChange(updatePlayers);

    return () => {
      room.onStateChange.remove(updatePlayers);
    };
  }, [gameRoomState]);

  // Ready状態を切り替え
  const toggleReady = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("toggleReady");
  }, [gameRoomState]);

  // 退席
  const leaveRoom = useCallback(async () => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("leaveRoom");
    navigateToLobby();
  }, [gameRoomState, navigateToLobby]);

  // 自分の座席インデックスを取得
  const mySeatIndex =
    players.findIndex(
      (p) => p !== null && myPlayer && p.name === myPlayer.name,
    ) ?? -1;

  return {
    players,
    mySessionId,
    mySeatIndex,
    isReady,
    toggleReady,
    leaveRoom,
    isConnected: gameRoomState.status === "connected",
  };
};
