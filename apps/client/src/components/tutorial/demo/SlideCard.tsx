const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> =
  {
    red: { bg: "#ef4444", border: "#dc2626", text: "#fff" },
    blue: { bg: "#3b82f6", border: "#2563eb", text: "#fff" },
    green: { bg: "#16a34a", border: "#15803d", text: "#fff" },
    yellow: { bg: "#facc15", border: "#eab308", text: "#000" },
    gray: { bg: "#6b7280", border: "#4b5563", text: "#fff" },
  };

const VALUE_DISPLAY: Record<string, string> = {
  skip: "\u29B8",
  reverse: "\u21C4",
  draw2: "+2",
  draw4: "+4",
  wild: "W",
  "force-change": "W",
};

interface SlideCardProps {
  color: string;
  value: string;
  size?: "small" | "normal";
  pointsLabel?: number;
}

export function SlideCard({
  color,
  value,
  size = "normal",
  pointsLabel,
}: SlideCardProps) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.gray;
  const display = VALUE_DISPLAY[value] ?? value;
  const isSmall = size === "small";

  return (
    <div
      style={{
        position: "relative",
        width: isSmall ? 44 : 56,
        height: isSmall ? 62 : 78,
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 8,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: colors.text,
        fontSize: isSmall ? 20 : 28,
        fontWeight: "bold",
        flexShrink: 0,
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    >
      {display}
      {pointsLabel !== undefined && (
        <span
          style={{
            position: "absolute",
            right: 2,
            bottom: 1,
            fontSize: isSmall ? 9 : 11,
            fontWeight: 600,
            opacity: 0.8,
          }}
        >
          {pointsLabel}
        </span>
      )}
    </div>
  );
}
