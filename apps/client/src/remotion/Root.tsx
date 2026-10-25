import "../index.css";
import { Composition } from "remotion";
import { FPS, totalDurationFrames } from "@/components/tutorial/data/script";
import { TutorialVideo } from "@/components/tutorial/TutorialVideo";

export function RemotionRoot() {
  return (
    <Composition
      component={TutorialVideo}
      durationInFrames={totalDurationFrames}
      fps={FPS}
      height={540}
      id="Tutorial"
      width={960}
    />
  );
}
