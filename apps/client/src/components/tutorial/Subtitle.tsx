import type { Speaker } from "./data/script";

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
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: SPEAKER_COLORS[speaker],
          fontFamily:
            "'Rounded Mplus 1c', 'M PLUS Rounded 1c', 'Hiragino Maru Gothic Pro', 'BIZ UDPGothic', sans-serif",
          fontSize: 22,
          fontWeight: "bold",
          lineHeight: 1.4,
          WebkitTextStroke: "2px white",
          paintOrder: "stroke fill",
        }}
      >
        {text}
      </span>
    </div>
  );
}
