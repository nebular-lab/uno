import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export function TutorialVideo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = Math.floor(frame / fps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1e293b",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 48, margin: 0 }}>ドボンUNO チュートリアル</h1>
      <p style={{ fontSize: 24, marginTop: 16, opacity: 0.7 }}>
        {seconds}秒経過 / フレーム: {frame}
      </p>
    </AbsoluteFill>
  );
}
