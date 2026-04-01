import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Character } from "./characters/Character";
import type { Dialogue, Scene } from "./data/script";
import { DemoArea } from "./demo/DemoArea";
import { Subtitle } from "./Subtitle";

function findCurrentDialogue(
  dialogues: Dialogue[],
  frame: number,
): Dialogue | null {
  for (const d of dialogues) {
    if (frame >= d.startFrame && frame < d.startFrame + d.durationFrames) {
      return d;
    }
  }
  return null;
}

interface TutorialSceneProps {
  scene: Scene;
}

export function TutorialScene({ scene }: TutorialSceneProps) {
  const frame = useCurrentFrame();
  const dialogue = findCurrentDialogue(scene.dialogues, frame);

  return (
    <AbsoluteFill>
      <DemoArea type={scene.demo.type} />

      <Character
        character="marisa"
        face={dialogue?.faceA ?? "normal"}
        isSpeaking={dialogue?.speaker === "A"}
        side="left"
      />

      <Character
        character="reimu"
        face={dialogue?.faceB ?? "normal"}
        isSpeaking={dialogue?.speaker === "B"}
        side="right"
      />

      {dialogue && <Subtitle speaker={dialogue.speaker} text={dialogue.text} />}
    </AbsoluteFill>
  );
}
