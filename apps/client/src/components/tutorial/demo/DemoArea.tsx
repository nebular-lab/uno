import type { DemoType } from "../data/script";

interface DemoAreaProps {
  type: DemoType;
}

const DEMO_TITLES: Record<DemoType, string> = {
  title: "ドボンUNO",
  basicRule: "基本ルール",
  stackAndCutIn: "重ね出し・カットイン",
  scoring: "点数計算",
  dobon: "ドボン",
  dobonReturn: "ドボン返し",
  strategy: "戦略",
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
