import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import {
  navigateToGameAtom,
  navigateToTitleAtom,
  screenAtom,
} from "./atoms/appAtoms";
import {
  gameStateAtom,
  lobbyStateAtom,
  resetDisconnectedAtom,
} from "./atoms/connectionAtoms";
import { ScalableContainer } from "./components/ScalableContainer";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { useBeforeUnload } from "./hooks/useBeforeUnload";
import { CreateRoomScreen } from "./screens/CreateRoomScreen";
import { GameScreen } from "./screens/GameScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { TitleScreen } from "./screens/TitleScreen";
import { WaitingRoomScreen } from "./screens/WaitingRoomScreen";

function App() {
  const screen = useAtomValue(screenAtom);
  const lobbyState = useAtomValue(lobbyStateAtom);
  const gameState = useAtomValue(gameStateAtom);
  const navigateToTitle = useSetAtom(navigateToTitleAtom);
  const navigateToGame = useSetAtom(navigateToGameAtom);
  const resetDisconnected = useSetAtom(resetDisconnectedAtom);

  // ブラウザ離脱防止（タイトル画面以外でリロード・タブ閉じ・戻るボタン時に確認表示）
  useBeforeUnload({
    currentScreen: screen.screen,
    onNavigateAway: navigateToTitle,
  });

  // phase変更に応じた画面遷移（waitingでなくなったらゲーム画面へ）
  useEffect(() => {
    if (gameState.status !== "connected") return;

    const room = gameState.room;
    const handleStateChange = () => {
      const phase = room.state.phase;
      if (phase !== "waiting" && screen.screen === "waitingRoom") {
        navigateToGame(room.roomId);
      }
    };

    // 初期状態をチェック
    handleStateChange();

    // 状態変更を購読
    room.onStateChange(handleStateChange);

    return () => {
      room.onStateChange.remove(handleStateChange);
    };
  }, [gameState, screen.screen, navigateToGame]);

  // 異常切断状態の判定
  const isDisconnected =
    lobbyState.status === "disconnected" || gameState.status === "disconnected";

  // 異常切断ダイアログのOKボタン押下時
  const handleDisconnectOk = () => {
    resetDisconnected();
    navigateToTitle();
  };

  const renderScreen = () => {
    switch (screen.screen) {
      case "title":
        return <TitleScreen />;
      case "lobby":
        return <LobbyScreen />;
      case "createRoom":
        return <CreateRoomScreen />;
      case "waitingRoom":
        return <WaitingRoomScreen roomId={screen.roomId} />;
      case "game":
        return <GameScreen roomId={screen.roomId} />;
      default:
        return <TitleScreen />;
    }
  };

  return (
    <>
      <ScalableContainer>{renderScreen()}</ScalableContainer>

      {/* 異常切断ダイアログ */}
      <Dialog open={isDisconnected}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>接続が切断されました</DialogTitle>
            <DialogDescription>
              サーバーとの接続が切断されました。タイトル画面に戻ります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDisconnectOk}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default App;
