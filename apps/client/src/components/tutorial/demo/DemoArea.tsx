import type { DemoType } from "../data/script";

interface DemoAreaProps {
  type: DemoType;
}

const DEMO_TITLES: Record<DemoType, string> = {
  title: "ドボンUNO",
  basicRule: "基本ルール",
  specialCards: "記号カード一覧",
  forceChange: "強制色変えカード",
  scoring: "ローカルルール①：点数計算",
  dobon: "ローカルルール②：ドボン",
  dobonReturn: "ローカルルール③：ドボン返し",
  otherRules: "その他のローカルルール",
  closing: "",
};

export function DemoArea({ type }: DemoAreaProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 80,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <span
        style={{
          color: "rgba(255, 255, 255, 0.3)",
          fontSize: 36,
          fontWeight: "bold",
        }}
      >
        {DEMO_TITLES[type]}
      </span>
    </div>
  );
}
