import { useAtomValue } from "jotai";
import { screenAtom } from "./atoms/appAtoms";
import { ScalableContainer } from "./components/ScalableContainer";
import { TitleScreen } from "./screens/TitleScreen";

function App() {
  const screen = useAtomValue(screenAtom);

  const renderScreen = () => {
    switch (screen.screen) {
      case "title":
        return <TitleScreen />;
      case "lobby":
        return <div>Lobby Screen (TODO)</div>;
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
