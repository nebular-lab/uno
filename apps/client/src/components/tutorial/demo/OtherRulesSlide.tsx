import { SlideCard } from "./SlideCard";

interface RuleInfo {
  label: string;
  description: string;
  visual: React.ReactNode;
}

function StackVisual() {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <SlideCard color="red" size="small" value="5" />
      <SlideCard color="red" size="small" value="5" />
    </div>
  );
}

function CutInVisual() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <SlideCard color="blue" size="small" value="3" />
      <span style={{ color: "#facc15", fontSize: 20, fontWeight: "bold" }}>
        →
      </span>
      <SlideCard color="blue" size="small" value="3" />
    </div>
  );
}

function NoSymbolFinishVisual() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <SlideCard color="red" size="small" value="skip" />
      <span style={{ color: "#ef4444", fontSize: 20, fontWeight: "bold" }}>
        ✕
      </span>
    </div>
  );
}

function OptionalDrawVisual() {
  return (
    <div
      style={{
        width: 44,
        height: 62,
        backgroundColor: "#374151",
        border: "2px solid #4b5563",
        borderRadius: 8,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#9ca3af",
        fontSize: 16,
        fontWeight: "bold",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    >
      ?
    </div>
  );
}

function StackingVisual() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <SlideCard color="red" size="small" value="draw2" />
      <span style={{ color: "#facc15", fontSize: 20, fontWeight: "bold" }}>
        →
      </span>
      <SlideCard color="blue" size="small" value="draw2" />
    </div>
  );
}

const RULES: RuleInfo[] = [
  {
    label: "スタッキング",
    description: "+2に+2か+4、+4に+4を出せる\nドロー数は溜まっていく",
    visual: <StackingVisual />,
  },
  {
    label: "重ね出し",
    description: "同じカードを持っていたら\nまとめて出せる",
    visual: <StackVisual />,
  },
  {
    label: "カットイン",
    description: "場と同じカードなら\n自分の番でなくても割り込める",
    visual: <CutInVisual />,
  },
  {
    label: "記号上がり禁止",
    description: "最後の1枚が記号カードだと\n出せない",
    visual: <NoSymbolFinishVisual />,
  },
  {
    label: "任意ドロー",
    description: "出せるカードがあっても\n山札から1枚引ける",
    visual: <OptionalDrawVisual />,
  },
];

function RuleRow({ rule }: { rule: RuleInfo }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 100,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {rule.visual}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>
          {rule.label}
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            lineHeight: 1.3,
            whiteSpace: "pre-line",
          }}
        >
          {rule.description}
        </span>
      </div>
    </div>
  );
}

export function OtherRulesSlide() {
  const leftColumn = RULES.slice(0, 3);
  const rightColumn = RULES.slice(3, 5);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: 48,
        padding: "0 60px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {leftColumn.map((rule) => (
          <RuleRow key={rule.label} rule={rule} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {rightColumn.map((rule) => (
          <RuleRow key={rule.label} rule={rule} />
        ))}
      </div>
    </div>
  );
}
