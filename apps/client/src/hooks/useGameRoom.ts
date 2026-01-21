import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { navigateToLobbyAtom, playerAtom } from "../atoms/appAtoms";
import { gamePlayStateAtom, gameStateAtom } from "../atoms/connectionAtoms";

// 型のre-export
export type { ClientCard, ClientPlayer } from "../types/connection";

export const useGameRoom = () => {
  const gameRoomState = useAtomValue(gameStateAtom);
  const gamePlayState = useAtomValue(gamePlayStateAtom);
  const myPlayer = useAtomValue(playerAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);

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

  // ゲーム開始
  const startGame = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("startGame");
  }, [gameRoomState]);

  // 自分の座席インデックスを取得
  const mySeatIndex =
    gamePlayState.players.findIndex(
      (p) => p !== null && myPlayer && p.name === myPlayer.name,
    ) ?? -1;

  // 自分がホストかどうか
  const isHost =
    mySeatIndex >= 0 && (gamePlayState.players[mySeatIndex]?.isHost ?? false);

  // 準備完了しているプレイヤー数
  const readyCount = gamePlayState.players.filter((p) => p?.isReady).length;

  return {
    // 待機画面用
    players: gamePlayState.players,
    mySessionId: gamePlayState.mySessionId,
    mySeatIndex,
    isReady: gamePlayState.isReady,
    isHost,
    readyCount,
    toggleReady,
    leaveRoom,
    startGame,
    isConnected: gameRoomState.status === "connected",
    // ゲーム画面用
    phase: gamePlayState.phase,
    dealingRound: gamePlayState.dealingRound,
    countdown: gamePlayState.countdown,
    fieldCards: gamePlayState.fieldCards,
    myHand: gamePlayState.myHand,
    currentTurnPlayerId: gamePlayState.currentTurnPlayerId,
    currentColor: gamePlayState.currentColor,
    deckCount: gamePlayState.deckCount,
  };
};
