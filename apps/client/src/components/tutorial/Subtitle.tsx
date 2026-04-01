import type { Speaker } from "./data/script";

const SPEAKER_NAMES: Record<Speaker, string> = {
  A: "まりさ",
  B: "霊夢",
};

const SPEAKER_COLORS: Record<Speaker, string> = {
  A: "#fbbf24",
  B: "#f87171",
};

interface SubtitleProps {
  speaker: Speaker;
  text: string;
}

export function Subtitle({ speaker, text }: SubtitleProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 70,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
      }}
    >
      <span
        style={{
          color: SPEAKER_COLORS[speaker],
          fontWeight: "bold",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {SPEAKER_NAMES[speaker]}
      </span>
      <span
        style={{
          color: "white",
          fontSize: 20,
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </div>
  );
}
