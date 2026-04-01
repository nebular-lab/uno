import type { DemoType } from "../data/script";
import { OtherRulesSlide } from "./OtherRulesSlide";
import { SpecialCardsSlide } from "./SpecialCardsSlide";

interface DemoAreaProps {
  type: DemoType;
}

const DEMO_TITLES: Record<DemoType, string> = {
  title: "ドボンUNO",
  basicRule: "基本ルール",
  specialCards: "",
  scoring: "ローカルルール①：点数計算",
  dobon: "ローカルルール②：ドボン",
  dobonReturn: "ローカルルール③：ドボン返し",
  otherRules: "",
  closing: "",
};

function DemoContent({ type }: { type: DemoType }) {
  if (type === "specialCards") return <SpecialCardsSlide />;
  if (type === "otherRules") return <OtherRulesSlide />;

  const title = DEMO_TITLES[type];
  if (!title) return null;

  return (
    <span
      style={{
        color: "rgba(255, 255, 255, 0.3)",
        fontSize: 36,
        fontWeight: "bold",
      }}
    >
      {title}
    </span>
  );
}

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
      <DemoContent type={type} />
    </div>
  );
}
