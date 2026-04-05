import { interpolate, useCurrentFrame } from "remotion";
import { FPS, scenes } from "../data/script";
import type { MockPlayer } from "./MockGameTable";
import { MockGameTable } from "./MockGameTable";
import { SlideCard } from "./SlideCard";

// scenesからドボンシーンのダイアログタイミングを取得
const dobonScene = scenes.find((s) => s.id === "dobon");
const dialogues = dobonScene?.dialogues ?? [];

// セリフ番号 → 開始フレーム
function dialogueStart(index: number): number {
  return dialogues[index]?.startFrame ?? 0;
}

// シナリオ: プレイヤーBが赤スキップ(20点)を出す → 自分がドボン(手札合計20点)（4人プレイ）
// 場は赤の2（赤のスキップを出せるカード）
// セリフ0: 「2つ目がこのゲームの目玉、ドボン」
// セリフ1: 「プレイヤーBが赤のスキップを出してきたな」→ カード移動
// セリフ2: 「お、ドボンボタンが明るくなったぞ」→ ドボンボタン活性化
// セリフ3: ルール説明
// セリフ4: 「確かに、スキップは20点で、5+7+8=20だな」
// セリフ5: 「ドボン！」→ ドボン実行
// セリフ6: 「ドボンすると…」→ 2秒後に各プレイヤー手札点数表示 → さらに2秒後に収支表示
// セリフ7: 「全員分？…」

export function DobonPlayDemo() {
  const frame = useCurrentFrame();

  // セリフに連動したタイミング
  const cardMoveStart = dialogueStart(1);
  const cardMoveEnd = cardMoveStart + 20;
  const dobonActiveStart = dialogueStart(2);
  const dobonPressFrame = dialogueStart(5);
  const afterDobonStart = dialogueStart(6);
  const handPointsStart = afterDobonStart + FPS * 2;
  const scoreStart = handPointsStart + FPS * 2;

  const cardMoveProgress = interpolate(
    frame,
    [cardMoveStart, cardMoveEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cardPlayed = frame >= cardMoveEnd;
  const dobonActive = frame >= dobonActiveStart;
  const showDobon = frame >= dobonPressFrame;
  const handPointsOpacity = interpolate(
    frame,
    [handPointsStart, handPointsStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scoreOpacity = interpolate(
    frame,
    [scoreStart, scoreStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const players: (MockPlayer | null)[] = [
    {
      name: "プレイヤーA",
      cardCount: 4,
      handPoints:
        handPointsOpacity > 0
          ? { value: 30, opacity: handPointsOpacity }
          : undefined,
    },
    {
      name: "プレイヤーB",
      cardCount: cardPlayed ? 2 : 3,
      isCurrentTurn: !cardPlayed,
      handPoints:
        handPointsOpacity > 0
          ? { value: 30, opacity: handPointsOpacity }
          : undefined,
      scoreChange:
        scoreOpacity > 0 ? { value: -110, opacity: scoreOpacity } : undefined,
    },
    null,
    {
      name: "あなた",
      cardCount: 3,
      label: showDobon ? { text: "ドボン！", color: "#a855f7" } : undefined,
      handPoints:
        handPointsOpacity > 0
          ? { value: 20, opacity: handPointsOpacity }
          : undefined,
      scoreChange:
        scoreOpacity > 0 ? { value: 110, opacity: scoreOpacity } : undefined,
    },
    null,
    {
      name: "プレイヤーC",
      cardCount: 5,
      handPoints:
        handPointsOpacity > 0
          ? { value: 30, opacity: handPointsOpacity }
          : undefined,
    },
  ];

  // カードアニメーション: 右上 → 場の中央
  const cardX = interpolate(cardMoveProgress, [0, 1], [850, 625]);
  const cardY = interpolate(cardMoveProgress, [0, 1], [130, 180]);
  const cardOpacity = interpolate(
    frame,
    [cardMoveStart, cardMoveStart + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <MockGameTable
      deckCount={38}
      fieldCard={
        cardPlayed
          ? { color: "red", value: "skip" }
          : { color: "red", value: "2" }
      }
      myHand={[
        { color: "red", value: "5", points: 5 },
        { color: "blue", value: "7", points: 7 },
        { color: "yellow", value: "8", points: 8 },
      ]}
      players={players}
      totalPoints={20}
    >
      {/* カードが飛んでいくアニメーション */}
      {frame >= cardMoveStart && frame < cardMoveEnd && (
        <div
          className="absolute z-30"
          style={{
            left: cardX,
            top: cardY,
            transform: "translate(-50%, -50%)",
            opacity: cardOpacity,
          }}
        >
          <SlideCard color="red" size="small" value="skip" />
        </div>
      )}

      {/* ドボンボタン */}
      <div className="fixed bottom-[150px] left-[100px]">
        <div
          className="flex size-[80px] items-center justify-center rounded-md font-bold text-white text-lg"
          style={{
            backgroundColor: dobonActive ? "#a855f7" : "#4b5563",
            opacity: dobonActive ? 1 : 0.5,
            boxShadow:
              dobonActive && !showDobon
                ? "0 0 20px rgba(168, 85, 247, 0.7)"
                : "none",
          }}
        >
          ドボン
        </div>
      </div>
    </MockGameTable>
  );
}
