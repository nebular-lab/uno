import { interpolate, useCurrentFrame } from "remotion";
import { FPS, scenes } from "../data/script";
import type { MockPlayer } from "./MockGameTable";
import { MockGameTable } from "./MockGameTable";
import { SlideCard } from "./SlideCard";

// scenesからドボン返しシーンのダイアログタイミングを取得
const dobonReturnScene = scenes.find((s) => s.id === "dobon-return");
const dialogues = dobonReturnScene?.dialogues ?? [];

function dialogueStart(index: number): number {
  return dialogues[index]?.startFrame ?? 0;
}

// シナリオ: 自分の手札 = +4, スキップ, リバース, 1, 2, 7（合計100点）
// +4(50) を出す → 残り: スキップ(20), リバース(20), 1, 2, 7 = 50点
// プレイヤーBがドボン(手札50点) → 自分がドボン返し
// A:30, B:50, あなた:50, C:30 → 全員合計160

// セリフ0: 「3つ目、ドボン返し」
// セリフ1: 「ドロー4を出そう」→ カード移動
// セリフ2: 「あ、プレイヤーBにドボンされてしまったな」→ ドボン表示
// セリフ3: 「お、でもドボン返しボタンが表示されたぞ」→ ドボン返しボタン活性化
// セリフ4: ルール説明
// セリフ5: 「今回は…ドボン返しできるんだな」
// セリフ6: 「ドボン返し！」→ ドボン返し実行
// セリフ7: 「ドボン返しをすると…」→ 2秒後に手札点数 → さらに2秒後に収支
// セリフ8: 「ドボン返し出来るようにしておけば…」

export function DobonReturnPlayDemo() {
  const frame = useCurrentFrame();

  // セリフに連動したタイミング
  // セリフ2:「はい」→ カード移動
  const cardMoveStart = dialogueStart(2);
  const cardMoveEnd = cardMoveStart + 20;
  const playedCard = frame >= cardMoveEnd;
  // セリフ3:「あー、ドボンされた…」→ ドボン表示 + ドボン返しボタン
  const opponentDobonStart = dialogueStart(3);
  const showOpponentDobon = frame >= opponentDobonStart;
  const dobonReturnActiveStart = dialogueStart(3);
  // セリフ6:「ドボン返し！」→ ドボン返し実行
  const dobonReturnPressFrame = dialogueStart(6);
  const showDobonReturn = frame >= dobonReturnPressFrame;
  // セリフ7:「ドボン返しをすると…」→ 2秒後に手札点数、さらに2秒後に収支
  const afterDobonReturnStart = dialogueStart(7);
  const handPointsStart = afterDobonReturnStart + FPS * 2;
  const scoreStart = handPointsStart + FPS * 2;

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

  const myCardMoveProgress = interpolate(
    frame,
    [cardMoveStart, cardMoveEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const myHandBefore = [
    { color: "gray", value: "draw4", points: 50 },
    { color: "red", value: "skip", points: 20 },
    { color: "blue", value: "reverse", points: 20 },
    { color: "green", value: "1", points: 1 },
    { color: "yellow", value: "2", points: 2 },
    { color: "red", value: "7", points: 7 },
  ];
  const myHandAfter = [
    { color: "red", value: "skip", points: 20 },
    { color: "blue", value: "reverse", points: 20 },
    { color: "green", value: "1", points: 1 },
    { color: "yellow", value: "2", points: 2 },
    { color: "red", value: "7", points: 7 },
  ];
  const myHand = playedCard ? myHandAfter : myHandBefore;

  // ドボン返しボタンの活性状態
  const dobonReturnActive = frame >= dobonReturnActiveStart && !showDobonReturn;

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
      cardCount: 5,
      label: showOpponentDobon
        ? { text: "ドボン！", color: "#a855f7" }
        : undefined,
      handPoints:
        handPointsOpacity > 0
          ? { value: 50, opacity: handPointsOpacity }
          : undefined,
      scoreChange:
        scoreOpacity > 0 ? { value: -160, opacity: scoreOpacity } : undefined,
    },
    null,
    {
      name: "あなた",
      cardCount: playedCard ? 5 : 6,
      isCurrentTurn: !playedCard,
      label: showDobonReturn
        ? { text: "ドボン返し！", color: "#f97316" }
        : undefined,
      handPoints:
        handPointsOpacity > 0
          ? { value: 50, opacity: handPointsOpacity }
          : undefined,
      scoreChange:
        scoreOpacity > 0 ? { value: 160, opacity: scoreOpacity } : undefined,
    },
    null,
    {
      name: "プレイヤーC",
      cardCount: 3,
      handPoints:
        handPointsOpacity > 0
          ? { value: 30, opacity: handPointsOpacity }
          : undefined,
    },
  ];

  // カードアニメーション: 下中央 → 場の中央
  const cardY = interpolate(myCardMoveProgress, [0, 1], [420, 180]);
  const cardOpacity = interpolate(
    frame,
    [cardMoveStart, cardMoveStart + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <MockGameTable
      deckCount={35}
      fieldCard={
        playedCard
          ? { color: "gray", value: "draw4" }
          : { color: "yellow", value: "6" }
      }
      myHand={myHand}
      players={players}
      totalPoints={playedCard ? 50 : 100}
    >
      {/* 自分のカードが飛んでいくアニメーション */}
      {frame >= cardMoveStart && frame < cardMoveEnd && (
        <div
          className="absolute z-30"
          style={{
            left: "50%",
            top: cardY,
            transform: "translate(-50%, 0)",
            opacity: cardOpacity,
          }}
        >
          <SlideCard color="gray" size="small" value="draw4" />
        </div>
      )}

      {/* ドボン返しボタン */}
      {dobonReturnActive && (
        <div className="fixed bottom-[150px] left-[100px]">
          <div
            className="flex size-[80px] items-center justify-center rounded-md font-bold text-white text-sm"
            style={{
              backgroundColor: "#f97316",
              boxShadow: "0 0 20px rgba(249, 115, 22, 0.7)",
            }}
          >
            ドボン返し
          </div>
        </div>
      )}
    </MockGameTable>
  );
}
