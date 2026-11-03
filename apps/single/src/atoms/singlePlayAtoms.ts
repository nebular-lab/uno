import {
  addSinglePlayRecordAtom,
  gamePlayStateAtom,
  gameStateAtom,
  initialGamePlayState,
  setupRoomStateSync,
} from "@dobon-uno/game-ui";
import { atom } from "jotai";
import { LocalGameRoom } from "../local/LocalGameRoom";

// 表示中の画面
export const screenAtom = atom<"title" | "game">("title");

// タイトル画面へ戻る
export const navigateToTitleAtom = atom(null, (_get, set) => {
  set(screenAtom, "title");
});

// シングルプレイを開始する（ブラウザ内にCPU4人がいるルームを作る）
export const startSinglePlayAtom = atom(null, (get, set) => {
  const current = get(gameStateAtom);
  if (current.status === "connected") return;

  const room = new LocalGameRoom();
  set(gameStateAtom, { status: "connected", room });
  setupRoomStateSync(room, set, false);

  // ゲームが終わるたびに自分の収支をブラウザに保存する
  let recordedCount = 0;
  room.onStateChange((state) => {
    const history = state.gameHistory;
    for (; recordedCount < history.length; recordedCount++) {
      const result = history[recordedCount];
      set(addSinglePlayRecordAtom, {
        timestamp: result.timestamp,
        scoreChange: result.scoreChanges.get(room.sessionId) ?? 0,
        rateMultiplier: result.rateMultiplier,
        finishType: result.finishType,
        isWinner: result.winnerId === room.sessionId,
      });
    }
  });

  room.onLeave(() => {
    set(gameStateAtom, { status: "idle" });
    set(gamePlayStateAtom, initialGamePlayState);
  });

  set(screenAtom, "game");
});
