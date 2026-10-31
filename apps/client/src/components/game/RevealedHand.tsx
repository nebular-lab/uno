import { cn } from "@/lib/utils";
import type { ClientCard } from "@/types/connection";
import { sortCards } from "@/utils/cardSort";
import { Card } from "./Card";

type Props = {
  cards: ClientCard[];
  displayIndex: number; // 表示位置（回転後の位置）
};

// 1行に並べる最大枚数（これを超えると折り返す）
// カードを重ねずに並べるため、横幅が広がりすぎないよう少なめにする
const CARDS_PER_ROW = 4;

// 表示位置ごとの配置（シート基準）
// 0: 上中央 → 席の右（席の下だと2列以上で場のカードと重なるため）
// 1, 2: 右側 → 席の左（テーブル側）
// 4, 5: 左側 → 席の右（テーブル側）
// 3: 自分 → 手札は画面下に表示済みのため表示しない
const handPositions = [
  "left-full ml-3 top-0 items-start",
  "right-full mr-3 top-1/2 -translate-y-1/2 items-end",
  "right-full mr-3 top-1/2 -translate-y-1/2 items-end",
  "left-full ml-3 top-1/2 -translate-y-1/2 items-start",
  "left-full ml-3 top-1/2 -translate-y-1/2 items-start",
  "left-full ml-3 top-1/2 -translate-y-1/2 items-start",
];

// 縮小カード（Cardを半分のサイズで表示）
const MiniCard = ({ card }: { card: ClientCard }) => (
  <div className="relative h-[55px] w-[39px] shrink-0">
    <div className="absolute top-0 left-0 origin-top-left scale-50">
      <Card card={card} />
    </div>
  </div>
);

/**
 * 公開された手札（上がり・ドボン・ドボン返し時）
 * 席の表示位置に応じて、テーブル側に手札を重ならないように並べて表示する
 */
export const RevealedHand = ({ cards, displayIndex }: Props) => {
  const position = handPositions[displayIndex] ?? handPositions[0];
  // 自分の手札は画面下に表示済み
  if (displayIndex === 3) return null;

  // 1行あたりCARDS_PER_ROW枚で分割
  const sorted = sortCards(cards);
  const rows: ClientCard[][] = [];
  for (let i = 0; i < sorted.length; i += CARDS_PER_ROW) {
    rows.push(sorted.slice(i, i + CARDS_PER_ROW));
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 flex flex-col gap-1 rounded-lg bg-slate-900/60 p-1.5 shadow-lg",
        position,
      )}
    >
      {rows.map((row) => (
        <div className="flex gap-1" key={row[0].id}>
          {row.map((card, index) => (
            <MiniCard card={card} key={`${card.id}-${index}`} />
          ))}
        </div>
      ))}
    </div>
  );
};
