import { useAtomValue, useSetAtom } from "jotai";
import { navigateToTitleAtom, screenAtom } from "./atoms/appAtoms";
import { ScalableContainer } from "./components/ScalableContainer";
import { useBeforeUnload } from "./hooks/useBeforeUnload";
import { CreateRoomScreen } from "./screens/CreateRoomScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { TitleScreen } from "./screens/TitleScreen";

function App() {
  const screen = useAtomValue(screenAtom);
  const navigateToTitle = useSetAtom(navigateToTitleAtom);

  // ブラウザ離脱防止（タイトル画面以外でリロード・タブ閉じ・戻るボタン時に確認表示）
  useBeforeUnload({
    currentScreen: screen.screen,
    onNavigateAway: navigateToTitle,
  });

  const renderScreen = () => {
    switch (screen.screen) {
      case "title":
        return <TitleScreen />;
      case "lobby":
        return <LobbyScreen />;
      case "createRoom":
        return <CreateRoomScreen />;
      case "room":
        return <div>Room Screen (TODO)</div>;
      case "game":
        return <div>Game Screen (TODO)</div>;
      default:
        return <TitleScreen />;
    }
  };

  return <ScalableContainer>{renderScreen()}</ScalableContainer>;
}

export default App;
