import type {
  DrawCardAnimationEvent,
  GameState,
  PassEvent,
  PlayCardAnimationEvent,
  Card as ServerCard,
  Player as ServerPlayer,
} from "@dobon-uno/shared";
import { DEFAULT_CPU_THINKING_TIME } from "@dobon-uno/shared";
import { atom, getDefaultStore } from "jotai";
import type {
  ClientCard,
  ClientPlayer,
  GamePlayState,
  GameRoomLike,
  GameRoomState,
} from "../types/connection";
import {
  type CardAnimation,
  currentAnimationAtom,
  currentDrawAnimationAtom,
  type DrawCardAnimation,
  passEventAtom,
} from "./animationAtoms";
import { fieldCardPositionAtom } from "./cardPositionAtom";

// Jotaiのデフォルトストア（アニメーション用）
const store = getDefaultStore();

// ゲームルーム接続状態
export const gameStateAtom = atom<GameRoomState>({ status: "idle" });

// 観戦時に表示する視点のプレイヤー（sessionId、未選択なら空文字）
export const viewpointSessionIdAtom = atom("");

// ゲームプレイ状態の初期値
export const initialGamePlayState: GamePlayState = {
  players: [null, null, null, null, null, null],
  mySessionId: "",
  isSpectator: false,
  spectatorCount: 0,
  isSinglePlay: false,
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
  rateMultiplier: 1,
  dobonPlayerIds: [],
  showTotalPoints: true,
  highlightPlayableCards: true,
  cpuThinkingTime: DEFAULT_CPU_THINKING_TIME,
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
    isCpu: serverPlayer.isCpu,
    timeRemaining: serverPlayer.timeRemaining,
    revealedHand: serverPlayer.revealedHand
      ? Array.from(serverPlayer.revealedHand).map(convertCard)
      : [],
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
// 観戦時は視点に選んだプレイヤーを「自分」として扱い、その人の手札・席配置で表示する
export const setupRoomStateSync = (
  room: GameRoomLike,
  set: (atom: typeof gamePlayStateAtom, value: GamePlayState) => void,
  isSpectator: boolean,
) => {
  // 表示上の「自分」のsessionId
  const getViewSessionId = () =>
    isSpectator ? store.get(viewpointSessionIdAtom) : room.sessionId;

  const updatePlayState = (state: GameState) => {
    const viewSessionId = getViewSessionId();
    // stateの各プロパティが初期化されているかチェック
    const playersMap = new Map<string, ServerPlayer>();
    if (state.players) {
      state.players.forEach((player, sessionId) => {
        playersMap.set(sessionId, player);
      });
    }

    const myServerPlayer = viewSessionId
      ? state.players?.get(viewSessionId)
      : undefined;

    // gameHistoryを変換
    const gameHistory = state.gameHistory
      ? Array.from(state.gameHistory).map((result) => {
          const scoreChanges: Record<string, number> = {};
          result.scoreChanges?.forEach((value, key) => {
            scoreChanges[key] = value;
          });
          const handPoints: Record<string, number> = {};
          result.handPoints?.forEach((value, key) => {
            handPoints[key] = value;
          });
          const playerNames: Record<string, string> = {};
          result.playerNames?.forEach((value, key) => {
            playerNames[key] = value;
          });
          return {
            gameNumber: result.gameNumber,
            scoreChanges,
            handPoints,
            playerNames,
            timestamp: result.timestamp,
            winnerId: result.winnerId,
            finishType: result.finishType,
            rateMultiplier: result.rateMultiplier ?? 1,
          };
        })
      : [];

    set(gamePlayStateAtom, {
      players: createSeatsArray(playersMap),
      mySessionId: viewSessionId,
      isSpectator,
      spectatorCount: state.spectatorCount ?? 0,
      isSinglePlay: state.isSinglePlay ?? false,
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
      rateMultiplier: state.rateMultiplier ?? 1,
      dobonPlayerIds: state.dobonPlayerIds
        ? Array.from(state.dobonPlayerIds)
        : [],
      showTotalPoints: state.showTotalPoints ?? true,
      highlightPlayableCards: state.highlightPlayableCards ?? true,
      cpuThinkingTime: state.cpuThinkingTime ?? DEFAULT_CPU_THINKING_TIME,
      gameHistory,
    });
  };

  // 初期状態を設定
  updatePlayState(room.state);

  // 状態変更を購読
  room.onStateChange(updatePlayState);

  // 観戦時は視点の切り替えで表示を更新する
  if (isSpectator) {
    const unsubscribe = store.sub(viewpointSessionIdAtom, () =>
      updatePlayState(room.state),
    );
    room.onLeave(unsubscribe);
  }

  // アニメーションイベントを購読
  room.onMessage("playCardAnimation", (event: PlayCardAnimationEvent) => {
    const isSelf = event.playerId === getViewSessionId();

    // 開始位置とサイズをスナップショット（カードが削除される前に取得）
    let startPosition: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;
    if (isSelf && event.cards.length > 0) {
      // 手札は引く・並び替える・スクロールするたびに位置が変わるため、出した瞬間の位置を実測する
      const cardElement = document.querySelector(
        `[data-card-id="${event.cards[0].id}"]`,
      );
      if (cardElement) {
        const rect = cardElement.getBoundingClientRect();
        startPosition = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      }
    } else {
      // 他プレイヤーの場合はシート位置を使用
      // 画面の大きさが変わると位置も変わるため、自分の手札と同じく出した瞬間の位置を実測する
      const seatElement = document.querySelector(
        `[data-seat-player-id="${event.playerId}"]`,
      );
      if (seatElement) {
        const rect = seatElement.getBoundingClientRect();
        // 他プレイヤーの場合は場のカードのサイズを使用
        const fieldPos = store.get(fieldCardPositionAtom);
        startPosition = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: fieldPos?.width ?? 40,
          height: fieldPos?.height ?? 56,
        };
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
      isCutIn: !event.isCurrentTurn,
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

  // ドローアニメーションイベントを購読
  room.onMessage("drawCardAnimation", (event: DrawCardAnimationEvent) => {
    const animation: DrawCardAnimation = {
      id: `draw-${Date.now()}`,
      playerId: event.playerId,
      seatId: event.seatId,
      cardCount: event.cardCount,
      startTime: Date.now(),
      duration: event.animationDuration,
    };

    store.set(currentDrawAnimationAtom, animation);

    // アニメーション完了後にクリア
    setTimeout(() => {
      store.set(currentDrawAnimationAtom, null);
    }, event.animationDuration);
  });

  // パスイベントを購読
  room.onMessage("pass", (event: PassEvent) => {
    store.set(passEventAtom, {
      playerId: event.playerId,
      seatId: event.seatId,
    });
  });
};

// 退席したときの画面遷移（アプリごとに設定する）
export const leaveRoomHandlerAtom = atom<{ onLeave: () => void }>({
  onLeave: () => {},
});
