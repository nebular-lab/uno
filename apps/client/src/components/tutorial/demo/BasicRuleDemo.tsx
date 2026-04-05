import { useCurrentFrame } from "remotion";
import { scenes } from "../data/script";
import type { MockPlayer } from "./MockGameTable";
import { MockGameTable, type MockHandCard } from "./MockGameTable";

// scenesから基本ルールシーンのダイアログタイミングを取得
const basicScene = scenes.find((s) => s.id === "basic");
const dialogues = basicScene?.dialogues ?? [];

function dialogueStart(index: number): number {
  return dialogues[index]?.startFrame ?? 0;
}

// 手札データ（ソート済み: 赤数字→赤記号→緑数字→青数字→黄数字）
const sortedHand = [
  { color: "red", value: "7", points: 7 },
  { color: "red", value: "skip", points: 20 },
  { color: "green", value: "1", points: 1 },
  { color: "green", value: "5", points: 5 },
  { color: "blue", value: "3", points: 3 },
  { color: "blue", value: "6", points: 6 },
  { color: "yellow", value: "2", points: 2 },
];

// 場が赤の5 → 赤のカードか5のカードが出せる
function isPlayable(card: { color: string; value: string }): boolean {
  return card.color === "red" || card.value === "5";
}

export function BasicRuleDemo() {
  const frame = useCurrentFrame();

  // セリフ2の開始でplayable表示
  const showPlayable = frame >= dialogueStart(2);

  const players: (MockPlayer | null)[] = [
    { name: "プレイヤーA", cardCount: 7 },
    { name: "プレイヤーB", cardCount: 7 },
    null,
    {
      name: "あなた",
      cardCount: 7,
      isCurrentTurn: true,
    },
    null,
    { name: "プレイヤーC", cardCount: 7 },
  ];

  const myHand: MockHandCard[] = sortedHand.map((card) => ({
    ...card,
    playable: showPlayable ? isPlayable(card) : undefined,
  }));

  return (
    <MockGameTable
      deckCount={63}
      fieldCard={{ color: "red", value: "5" }}
      myHand={myHand}
      players={players}
    />
  );
}
