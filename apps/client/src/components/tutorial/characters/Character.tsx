import { Img, useCurrentFrame } from "remotion";
import type { MarisaFace, ReimuFace } from "../data/script";

const MOUTH_TOGGLE_INTERVAL = 4; // 4フレームごとに口を開閉

function getMarisaImage(face: MarisaFace, mouthOpen: boolean): string {
  const mouth = mouthOpen ? "open" : "close";
  return `/tutorial/characters/marisa_${face}_${mouth}.png`;
}

function getReimuImage(face: ReimuFace, mouthOpen: boolean): string {
  const mouth = mouthOpen ? "open" : "close";
  return `/tutorial/characters/reimu_${face}_${mouth}.png`;
}

interface CharacterProps {
  character: "marisa" | "reimu";
  face: MarisaFace | ReimuFace;
  isSpeaking: boolean;
}

export function Character({ character, face, isSpeaking }: CharacterProps) {
  const frame = useCurrentFrame();
  const mouthOpen =
    isSpeaking && frame % (MOUTH_TOGGLE_INTERVAL * 2) < MOUTH_TOGGLE_INTERVAL;

  const src =
    character === "marisa"
      ? getMarisaImage(face as MarisaFace, mouthOpen)
      : getReimuImage(face as ReimuFace, mouthOpen);

  return (
    <div
      style={{
        flexShrink: 0,
        filter: isSpeaking ? "brightness(1)" : "brightness(0.7)",
      }}
    >
      <Img
        src={src}
        style={{
          height: 130,
          objectFit: "contain",
          transform: character === "marisa" ? "scaleX(-1)" : undefined,
        }}
      />
    </div>
  );
}
