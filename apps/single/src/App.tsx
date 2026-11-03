import {
  CardPlayAnimation,
  GameScreen,
  gameStateAtom,
  leaveRoomHandlerAtom,
  ScalableContainer,
} from "@dobon-uno/game-ui";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { navigateToTitleAtom, screenAtom } from "./atoms/singlePlayAtoms";
import { TitleScreen } from "./screens/TitleScreen";

function App() {
  const screen = useAtomValue(screenAtom);
  const gameState = useAtomValue(gameStateAtom);
  const navigateToTitle = useSetAtom(navigateToTitleAtom);
  const setLeaveRoomHandler = useSetAtom(leaveRoomHandlerAtom);

  // ゲーム画面から退席したらタイトルへ戻る
  useEffect(() => {
    setLeaveRoomHandler({ onLeave: navigateToTitle });
  }, [setLeaveRoomHandler, navigateToTitle]);

  // ゲーム中のリロード・タブ閉じは確認する（進行状況はブラウザに残らない）
  const isPlaying = screen === "game" && gameState.status === "connected";
  useEffect(() => {
    if (!isPlaying) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isPlaying]);

  return (
    <>
      <ScalableContainer>
        {isPlaying ? <GameScreen /> : <TitleScreen />}
      </ScalableContainer>

      {/* カードアニメーション（ScalableContainerの外でビューポート基準で表示） */}
      {isPlaying && <CardPlayAnimation />}
    </>
  );
}

export default App;
