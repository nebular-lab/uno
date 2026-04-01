import { AbsoluteFill, Series } from "remotion";
import { scenes } from "./data/script";
import { TutorialScene } from "./TutorialScene";

export function TutorialVideo() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1e293b",
        fontFamily: "sans-serif",
      }}
    >
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence
            durationInFrames={scene.durationFrames}
            key={scene.id}
          >
            <TutorialScene scene={scene} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
