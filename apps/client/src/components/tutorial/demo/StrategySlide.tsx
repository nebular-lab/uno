export function StrategySlide() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: 32,
      }}
    >
      <span
        style={{
          color: "rgba(255,255,255,0.9)",
          fontSize: 32,
          fontWeight: "bold",
        }}
      >
        ゲーム性
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          maxWidth: 600,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: 18,
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            守り
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 16,
              lineHeight: 1.5,
            }}
          >
            ドボンされるのを警戒して大きな失点を防ぐ
          </span>
        </div>
        <span
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 24,
            fontWeight: "bold",
          }}
        >
          ×
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: 18,
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            攻め
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 16,
              lineHeight: 1.5,
            }}
          >
            上がりやドボンを狙って得点を稼ぐ
          </span>
        </div>
      </div>
    </div>
  );
}
