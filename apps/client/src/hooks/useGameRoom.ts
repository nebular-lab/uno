import type { CardColor } from "@dobon-uno/shared";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { navigateToLobbyAtom } from "../atoms/appAtoms";
import { gamePlayStateAtom, gameStateAtom } from "../atoms/connectionAtoms";

// 型のre-export
export type { ClientCard, ClientPlayer } from "../types/connection";

export const useGameRoom = () => {
  const gameRoomState = useAtomValue(gameStateAtom);
  const gamePlayState = useAtomValue(gamePlayStateAtom);
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

  // 自分の座席インデックスを取得（sessionIdで識別）
  const mySeatIndex =
    gamePlayState.players.findIndex(
      (p) => p !== null && p.sessionId === gamePlayState.mySessionId,
    ) ?? -1;

  // 自分がホストかどうか
  const isHost =
    mySeatIndex >= 0 && (gamePlayState.players[mySeatIndex]?.isHost ?? false);

  // 準備完了しているプレイヤー数
  const readyCount = gamePlayState.players.filter((p) => p?.isReady).length;

  // 自分のプレイヤー情報を取得
  const myPlayerInfo =
    mySeatIndex >= 0 ? gamePlayState.players[mySeatIndex] : null;

  // アクション関数
  const drawCard = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("drawCard");
  }, [gameRoomState]);

  const drawStack = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("drawStack");
  }, [gameRoomState]);

  const dobon = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("dobon");
  }, [gameRoomState]);

  const dobonReturn = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("dobonReturn");
  }, [gameRoomState]);

  const chooseColor = useCallback(
    (color: CardColor) => {
      if (gameRoomState.status !== "connected") return;
      gameRoomState.room.send("chooseColor", color);
    },
    [gameRoomState],
  );

  const playCard = useCallback(
    (cardId: string, stackCount = 1) => {
      if (gameRoomState.status !== "connected") return;
      gameRoomState.room.send("playCard", { cardId, stackCount });
    },
    [gameRoomState],
  );

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
    drawStackCount: gamePlayState.drawStack,
    // アクションフラグ
    canDraw: myPlayerInfo?.canDraw ?? false,
    canDrawStack: myPlayerInfo?.canDrawStack ?? false,
    canChooseColor: myPlayerInfo?.canChooseColor ?? false,
    canDobon: myPlayerInfo?.canDobon ?? false,
    canDobonReturn: myPlayerInfo?.canDobonReturn ?? false,
    playableCards: myPlayerInfo?.playableCards ?? {},
    // アクション関数
    drawCard,
    drawStack,
    dobon,
    dobonReturn,
    chooseColor,
    playCard,
  };
};
