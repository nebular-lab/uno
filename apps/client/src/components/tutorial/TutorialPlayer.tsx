import { Player } from "@remotion/player";
import { TutorialVideo } from "./TutorialVideo";

const FPS = 30;
const DURATION_SECONDS = 5;

export function TutorialPlayer() {
  return (
    <Player
      component={TutorialVideo}
      compositionHeight={540}
      compositionWidth={960}
      controls
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      style={{
        width: "100%",
        maxWidth: 960,
      }}
    />
  );
}
