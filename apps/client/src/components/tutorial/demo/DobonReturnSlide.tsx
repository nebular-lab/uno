import { SlideCard } from "./SlideCard";

export function DobonReturnSlide() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: 20,
      }}
    >
      <span style={{ color: "#facc15", fontSize: 28, fontWeight: "bold" }}>
        ドボン返し
      </span>
      <span
        style={{
          color: "rgba(255,255,255,0.8)",
          fontSize: 16,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        ドボンされた人の残り手札の合計 ＝ ドボンした人の手札の合計
        <br />→ ドボン返しで逆転！
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            ドボンされた人の残り手札
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <SlideCard color="gray" size="small" value="draw4" />
          </div>
          <span style={{ color: "#facc15", fontSize: 13, fontWeight: "bold" }}>
            50点
          </span>
        </div>
        <span style={{ color: "#facc15", fontSize: 24, fontWeight: "bold" }}>
          ＝
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            ドボンした人の手札
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <SlideCard color="gray" size="small" value="draw4" />
          </div>
          <span style={{ color: "#facc15", fontSize: 13, fontWeight: "bold" }}>
            50点
          </span>
        </div>
      </div>
    </div>
  );
}
