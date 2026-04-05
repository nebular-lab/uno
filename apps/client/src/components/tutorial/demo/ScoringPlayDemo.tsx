import { interpolate, useCurrentFrame } from "remotion";
import { FPS, scenes } from "../data/script";
import type { MockPlayer } from "./MockGameTable";
import { MockGameTable } from "./MockGameTable";
import { SlideCard } from "./SlideCard";

// scenesからscoring-playシーンのダイアログタイミングを取得
const scoringPlayScene = scenes.find((s) => s.id === "scoring-play");
const dialogues = scoringPlayScene?.dialogues ?? [];

function dialogueStart(index: number): number {
  return dialogues[index]?.startFrame ?? 0;
}

// シナリオ: 上中央のプレイヤーAが赤7を出して上がり（4人プレイ）
// プレイヤーA(上がり): +140
// プレイヤーB(右上): 手札30点 → -30
// あなた(下中央): 手札80点(+4,スキップ,1,2,7) → -80
// プレイヤーC(左上): 手札30点 → -30

// セリフ0: 「例えばこんな感じだ」→ カード移動
// セリフ1: 「プレイヤーAが上がったね…」→ 上がり表示、2秒後に点数表示
// セリフ2: 「80点も取られちゃうのか」
// セリフ3: 「誰かが上がりそうになったら…」

export function ScoringPlayDemo() {
  const frame = useCurrentFrame();

  const cardMoveStart = dialogueStart(0);
  const cardMoveEnd = cardMoveStart + 20;
  const cardPlayed = frame >= cardMoveEnd;

  const showWinner = frame >= dialogueStart(1);
  const scoreStart = dialogueStart(1) + FPS * 2;
  const scoreOpacity = interpolate(
    frame,
    [scoreStart, scoreStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const cardMoveProgress = interpolate(
    frame,
    [cardMoveStart, cardMoveEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cardOpacity = interpolate(
    frame,
    [cardMoveStart, cardMoveStart + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const topPlayerCards = cardPlayed ? 0 : 1;

  const players: (MockPlayer | null)[] = [
    {
      name: "プレイヤーA",
      cardCount: topPlayerCards,
      isCurrentTurn: !cardPlayed,
      label: showWinner
        ? { text: "上がり！", color: "#eab308", textColor: "text-black" }
        : undefined,
      scoreChange:
        scoreOpacity > 0 ? { value: 140, opacity: scoreOpacity } : undefined,
    },
    {
      name: "プレイヤーB",
      cardCount: 4,
      scoreChange:
        scoreOpacity > 0 ? { value: -30, opacity: scoreOpacity } : undefined,
    },
    null,
    {
      name: "あなた",
      cardCount: 5,
      scoreChange:
        scoreOpacity > 0 ? { value: -80, opacity: scoreOpacity } : undefined,
    },
    null,
    {
      name: "プレイヤーC",
      cardCount: 5,
      scoreChange:
        scoreOpacity > 0 ? { value: -30, opacity: scoreOpacity } : undefined,
    },
  ];

  const cardY = interpolate(cardMoveProgress, [0, 1], [60, 180]);

  return (
    <MockGameTable
      deckCount={42}
      fieldCard={
        cardPlayed
          ? { color: "red", value: "7" }
          : { color: "blue", value: "3" }
      }
      myHand={[
        { color: "gray", value: "draw4", points: 50 },
        { color: "red", value: "skip", points: 20 },
        { color: "green", value: "1", points: 1 },
        { color: "yellow", value: "2", points: 2 },
        { color: "red", value: "7", points: 7 },
      ]}
      players={players}
      totalPoints={80}
    >
      {frame >= cardMoveStart && !cardPlayed && (
        <div
          className="absolute z-30"
          style={{
            left: "50%",
            top: cardY,
            transform: "translate(-50%, 0)",
            opacity: cardOpacity,
          }}
        >
          <SlideCard color="red" size="small" value="7" />
        </div>
      )}
    </MockGameTable>
  );
}
