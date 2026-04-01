import { Player } from "@remotion/player";
import { FPS, totalDurationFrames } from "./data/script";
import { TutorialVideo } from "./TutorialVideo";

export function TutorialPlayer() {
  return (
    <Player
      component={TutorialVideo}
      compositionHeight={540}
      compositionWidth={960}
      controls
      durationInFrames={totalDurationFrames}
      fps={FPS}
      style={{
        width: "100%",
        maxWidth: 960,
      }}
    />
  );
}
