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

  // プレイヤー数
  const playerCount = gamePlayState.players.filter((p) => p !== null).length;

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
    (cardIds: string[]) => {
      if (gameRoomState.status !== "connected") return;
      gameRoomState.room.send("playCard", { cardIds });
    },
    [gameRoomState],
  );

  const pass = useCallback(() => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("pass");
  }, [gameRoomState]);

  // 最新のゲーム結果を取得
  const latestGameResult =
    gamePlayState.gameHistory.length > 0
      ? gamePlayState.gameHistory[gamePlayState.gameHistory.length - 1]
      : null;

  return {
    // 待機画面用
    players: gamePlayState.players,
    mySessionId: gamePlayState.mySessionId,
    mySeatIndex,
    isHost,
    playerCount,
    leaveRoom,
    startGame,
    isConnected: gameRoomState.status === "connected",
    // ゲーム画面用
    phase: gamePlayState.phase,
    dealingRound: gamePlayState.dealingRound,
    countdown: gamePlayState.countdown,
    fieldCards: gamePlayState.fieldCards,
    lastPlayedCount: gamePlayState.lastPlayedCount,
    myHand: gamePlayState.myHand,
    currentTurnPlayerId: gamePlayState.currentTurnPlayerId,
    currentColor: gamePlayState.currentColor,
    deckCount: gamePlayState.deckCount,
    drawStackCount: gamePlayState.drawStack,
    turnDirection: gamePlayState.turnDirection,
    // ドボン状態
    dobonPlayerIds: gamePlayState.dobonPlayerIds,
    // ゲーム履歴
    gameHistory: gamePlayState.gameHistory,
    latestGameResult,
    // アクションフラグ
    canDraw: myPlayerInfo?.canDraw ?? false,
    canDrawStack: myPlayerInfo?.canDrawStack ?? false,
    canChooseColor: myPlayerInfo?.canChooseColor ?? false,
    canDobon: myPlayerInfo?.canDobon ?? false,
    canDobonReturn: myPlayerInfo?.canDobonReturn ?? false,
    canPass: myPlayerInfo?.canPass ?? false,
    playableCards: myPlayerInfo?.playableCards ?? {},
    // アクション関数
    drawCard,
    drawStack,
    dobon,
    dobonReturn,
    chooseColor,
    playCard,
    pass,
  };
};
