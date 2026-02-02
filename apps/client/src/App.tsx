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
import { CardPlayAnimation } from "./components/game/CardPlayAnimation";
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

  // phase変更に応じた画面遷移（ゲーム進行中のフェーズになったらゲーム画面へ）
  useEffect(() => {
    if (gameState.status !== "connected") return;

    const room = gameState.room;
    // ゲーム進行中を示す有効なフェーズ（waitingや未初期化状態は除外）
    const playingPhases = ["countdown", "revealing", "playing", "result"];
    const handleStateChange = () => {
      const phase = room.state.phase;
      if (playingPhases.includes(phase) && screen.screen === "waitingRoom") {
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
        return <GameScreen />;
      default:
        return <TitleScreen />;
    }
  };

  return (
    <>
      <ScalableContainer>
        {renderScreen()}

        {/* 異常切断ダイアログ */}
        <Dialog open={isDisconnected}>
          <DialogContent className="w-[480px] p-9">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-white">
                接続が切断されました
              </DialogTitle>
              <DialogDescription className="mt-3 text-base text-slate-300">
                サーバーとの接続が切断されました。タイトル画面に戻ります。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-8">
              <Button
                className="h-20 w-full text-2xl font-semibold bg-blue-600 text-white hover:bg-blue-500"
                onClick={handleDisconnectOk}
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ScalableContainer>

      {/* カード出しアニメーション（ScalableContainerの外でビューポート基準で表示） */}
      {screen.screen === "game" && <CardPlayAnimation />}
    </>
  );
}

export default App;
