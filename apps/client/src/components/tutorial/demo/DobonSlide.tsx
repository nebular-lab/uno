import { SlideCard } from "./SlideCard";

export function DobonSlide() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: 24,
      }}
    >
      <span style={{ color: "#facc15", fontSize: 28, fontWeight: "bold" }}>
        ドボン
      </span>
      <span
        style={{
          color: "rgba(255,255,255,0.8)",
          fontSize: 16,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        手札の合計点数 ＝ 場のカードの点数 → ドボンで上がれる！
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            場のカード
          </span>
          <SlideCard color="red" value="5" />
          <span style={{ color: "#facc15", fontSize: 14, fontWeight: "bold" }}>
            5点
          </span>
        </div>
        <span style={{ color: "#facc15", fontSize: 28, fontWeight: "bold" }}>
          ＝
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            手札
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <SlideCard color="blue" value="2" />
            <SlideCard color="green" value="3" />
          </div>
          <span style={{ color: "#facc15", fontSize: 14, fontWeight: "bold" }}>
            2 + 3 = 5点
          </span>
        </div>
      </div>
    </div>
  );
}
