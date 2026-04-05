import type { DemoType } from "../data/script";
import { BasicRuleDemo } from "./BasicRuleDemo";
import { DobonPlayDemo } from "./DobonPlayDemo";
import { DobonReturnPlayDemo } from "./DobonReturnPlayDemo";
import { OtherRulesSlide } from "./OtherRulesSlide";
import { ScoringPlayDemo } from "./ScoringPlayDemo";
import { ScoringSlide } from "./ScoringSlide";
import { SpecialCardsSlide } from "./SpecialCardsSlide";
import { StrategySlide } from "./StrategySlide";

interface DemoAreaProps {
  type: DemoType;
}

function TitleScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: 8,
        }}
      >
        ドボンUNO
      </span>
      <span
        style={{
          fontSize: 20,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        ルール説明
      </span>
    </div>
  );
}

function DemoContent({ type }: { type: DemoType }) {
  switch (type) {
    case "title":
      return <TitleScreen />;
    case "basicRule":
      return <BasicRuleDemo />;
    case "specialCards":
      return <SpecialCardsSlide />;
    case "forceChangeCards":
      return <SpecialCardsSlide highlightForceChange />;
    case "scoringSlide":
      return <ScoringSlide />;
    case "scoringPlay":
      return <ScoringPlayDemo />;
    case "dobonPlay":
      return <DobonPlayDemo />;
    case "dobonReturnPlay":
      return <DobonReturnPlayDemo />;
    case "otherRules":
      return <OtherRulesSlide />;
    case "closing":
      return <StrategySlide />;
    default:
      return null;
  }
}

const GAME_UI_TYPES: DemoType[] = [
  "basicRule",
  "scoringPlay",
  "dobonPlay",
  "dobonReturnPlay",
];

export function DemoArea({ type }: DemoAreaProps) {
  const isGameUI = GAME_UI_TYPES.includes(type);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: isGameUI ? 0 : 80,
        display: "flex",
        justifyContent: "center",
        alignItems: isGameUI ? "flex-start" : "center",
        overflow: "hidden",
      }}
    >
      <DemoContent type={type} />
    </div>
  );
}
