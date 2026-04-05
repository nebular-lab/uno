import { useCurrentFrame } from "remotion";
import { scenes } from "../data/script";
import { SlideCard } from "./SlideCard";

// scoring-slideシーンのダイアログタイミングを取得
const scoringSlideScene = scenes.find((s) => s.id === "scoring-slide");
const dialogues = scoringSlideScene?.dialogues ?? [];

// セリフ3:「この点数は、「カードに点数を表示」設定を…」の開始フレーム
const showPointsFrame = dialogues[3]?.startFrame ?? 0;

interface ScoreRow {
  color: string;
  value: string;
  label: string;
  points: string;
  pointsNum?: number;
}

const SCORE_DATA: ScoreRow[] = [
  {
    color: "blue",
    value: "5",
    label: "数字カード",
    points: "その数字",
    pointsNum: 5,
  },
  {
    color: "red",
    value: "skip",
    label: "スキップ",
    points: "20点",
    pointsNum: 20,
  },
  {
    color: "green",
    value: "reverse",
    label: "リバース",
    points: "20点",
    pointsNum: 20,
  },
  {
    color: "yellow",
    value: "draw2",
    label: "ドロー2",
    points: "20点",
    pointsNum: 20,
  },
  {
    color: "red",
    value: "force-change",
    label: "固定色変え",
    points: "10点",
    pointsNum: 10,
  },
  {
    color: "gray",
    value: "wild",
    label: "色変え",
    points: "30点",
    pointsNum: 30,
  },
  {
    color: "gray",
    value: "draw4",
    label: "ドロー4",
    points: "50点",
    pointsNum: 50,
  },
];

function ScoreItem({
  row,
  showCardPoints,
}: {
  row: ScoreRow;
  showCardPoints: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <SlideCard
        color={row.color}
        pointsLabel={
          showCardPoints && row.pointsNum !== undefined
            ? row.pointsNum
            : undefined
        }
        size="small"
        value={row.value}
      />
      <span style={{ color: "#fff", fontSize: 14, width: 80 }}>
        {row.label}
      </span>
      <span
        style={{
          color: "#facc15",
          fontSize: 16,
          fontWeight: "bold",
        }}
      >
        {row.points}
      </span>
    </div>
  );
}

export function ScoringSlide() {
  const frame = useCurrentFrame();
  const showCardPoints = frame >= showPointsFrame;

  const leftColumn = SCORE_DATA.slice(0, 4);
  const rightColumn = SCORE_DATA.slice(4, 7);

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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {leftColumn.map((row) => (
          <ScoreItem
            key={row.label}
            row={row}
            showCardPoints={showCardPoints}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rightColumn.map((row) => (
          <ScoreItem
            key={row.label}
            row={row}
            showCardPoints={showCardPoints}
          />
        ))}
      </div>
    </div>
  );
}
