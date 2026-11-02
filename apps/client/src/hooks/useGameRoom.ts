import type { CardColor } from "@dobon-uno/shared";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { navigateToLobbyAtom, navigateToTitleAtom } from "../atoms/appAtoms";
import {
  gamePlayStateAtom,
  gameStateAtom,
  viewpointSessionIdAtom,
} from "../atoms/connectionAtoms";

// 型のre-export
export type { ClientCard } from "../types/connection";

export const useGameRoom = () => {
  const gameRoomState = useAtomValue(gameStateAtom);
  const gamePlayState = useAtomValue(gamePlayStateAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);
  const navigateToTitle = useSetAtom(navigateToTitleAtom);
  const setViewpointSessionId = useSetAtom(viewpointSessionIdAtom);

  // 退席（シングルプレイはロビーを経由しないのでタイトルへ戻る）
  const isSinglePlay = gamePlayState.isSinglePlay;
  const leaveRoom = useCallback(async () => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("leaveRoom");
    if (isSinglePlay) {
      navigateToTitle();
    } else {
      navigateToLobby();
    }
  }, [gameRoomState, isSinglePlay, navigateToLobby, navigateToTitle]);

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

  // 観戦者かどうか（観戦時のmySeatIndexは視点に選んだプレイヤーの席）
  const isSpectator = gamePlayState.isSpectator;

  // 自分がホストかどうか
  const isHost =
    !isSpectator &&
    mySeatIndex >= 0 &&
    (gamePlayState.players[mySeatIndex]?.isHost ?? false);

  // プレイヤー数
  const playerCount = gamePlayState.players.filter((p) => p !== null).length;

  // 自分のプレイヤー情報を取得（観戦者は操作できないのでアクションフラグを使わない）
  const myPlayerInfo =
    !isSpectator && mySeatIndex >= 0
      ? gamePlayState.players[mySeatIndex]
      : null;

  // 観戦時に視点として表示するプレイヤーの情報
  const viewpointPlayer =
    isSpectator && mySeatIndex >= 0 ? gamePlayState.players[mySeatIndex] : null;

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

  // CPU追加（seatIdは1-6）
  const addCpu = useCallback(
    (seatId: number) => {
      if (gameRoomState.status !== "connected") return;
      gameRoomState.room.send("addCpu", { seatId });
    },
    [gameRoomState],
  );

  // CPU削除
  const removeCpu = useCallback(
    (sessionId: string) => {
      if (gameRoomState.status !== "connected") return;
      gameRoomState.room.send("removeCpu", { sessionId });
    },
    [gameRoomState],
  );

  // ゲーム全体設定を更新
  const updateGameSettings = useCallback(
    (settings: {
      showTotalPoints?: boolean;
      highlightPlayableCards?: boolean;
      cpuThinkingTime?: number;
    }) => {
      if (gameRoomState.status !== "connected") return;
      gameRoomState.room.send("updateGameSettings", settings);
    },
    [gameRoomState],
  );

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
    isSinglePlay,
    // 観戦用
    isSpectator,
    spectatorCount: gamePlayState.spectatorCount,
    viewpointPlayer,
    setViewpointSessionId,
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
    rateMultiplier: gamePlayState.rateMultiplier,
    // ドボン状態
    dobonPlayerIds: gamePlayState.dobonPlayerIds,
    // ホスト設定
    showTotalPoints: gamePlayState.showTotalPoints,
    highlightPlayableCards: gamePlayState.highlightPlayableCards,
    cpuThinkingTime: gamePlayState.cpuThinkingTime,
    updateGameSettings,
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
    playableCards:
      (isSpectator ? viewpointPlayer : myPlayerInfo)?.playableCards ?? {},
    // アクション関数
    drawCard,
    drawStack,
    dobon,
    dobonReturn,
    chooseColor,
    playCard,
    pass,
    // CPU関連
    addCpu,
    removeCpu,
  };
};
