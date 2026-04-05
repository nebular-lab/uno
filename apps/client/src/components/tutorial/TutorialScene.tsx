import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { Character } from "./characters/Character";
import type { Dialogue, Scene } from "./data/script";
import { FPS } from "./data/script";
import { DemoArea } from "./demo/DemoArea";
import { Subtitle } from "./Subtitle";

const SECTION_TITLE_FRAMES = FPS * 3;

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
  const hasSectionTitle = !!scene.sectionTitle;
  const hasIntro = !!scene.showSectionIntro;

  // セクションタイトルの中央表示（最初の3秒）
  const isTitlePhase = hasIntro && frame < SECTION_TITLE_FRAMES;
  const titleOpacity = hasIntro
    ? interpolate(
        frame,
        [0, 15, SECTION_TITLE_FRAMES - 15, SECTION_TITLE_FRAMES],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  return (
    <AbsoluteFill>
      {/* セクションタイトル中央表示（最初の3秒） */}
      {isTitlePhase && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
            opacity: titleOpacity,
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: 40,
              fontWeight: "bold",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            {scene.sectionTitle}
          </span>
        </div>
      )}

      {/* セクションタイトル左上表示（タイトルフェーズ後に常時表示） */}
      {hasSectionTitle && !isTitlePhase && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 16,
            zIndex: 40,
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            {scene.sectionTitle}
          </span>
        </div>
      )}

      {/* デモ領域（タイトルフェーズ中は非表示） */}
      {!isTitlePhase && <DemoArea type={scene.demo.type} />}

      {/* 字幕バー（キャラクター + 字幕、タイトルフェーズ中は非表示） */}
      {!isTitlePhase && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 8px",
            gap: 4,
          }}
        >
          <Character
            character="marisa"
            face={dialogue?.faceA ?? "normal"}
            isSpeaking={dialogue?.speaker === "A"}
          />
          {dialogue ? (
            <Subtitle speaker={dialogue.speaker} text={dialogue.text} />
          ) : (
            <div style={{ flex: 1 }} />
          )}
          <Character
            character="reimu"
            face={dialogue?.faceB ?? "normal"}
            isSpeaking={dialogue?.speaker === "B"}
          />
        </div>
      )}

      {/* 音声再生 */}
      {scene.dialogues.map((d) => (
        <Sequence from={d.startFrame} key={d.audio} layout="none">
          <Audio src={d.audio} volume={1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
