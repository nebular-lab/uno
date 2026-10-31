import { cn } from "@/lib/utils";
import type { ClientCard } from "@/types/connection";
import { sortCards } from "@/utils/cardSort";
import { Card } from "./Card";

type Props = {
  cards: ClientCard[];
  displayIndex: number; // 表示位置（回転後の位置）
};

// 1行に並べる最大枚数（これを超えると折り返す）
const CARDS_PER_ROW = 7;

// 表示位置ごとの配置（シート基準）
// 0: 上中央 → 席の下
// 1, 2: 右側 → 席の左（テーブル側）
// 4, 5: 左側 → 席の右（テーブル側）
// 3: 自分 → 手札は画面下に表示済みのため、合計点のみ席の右に表示
const handPositions = [
  "top-full mt-3 left-1/2 -translate-x-1/2 flex-row",
  "right-full mr-3 top-1/2 -translate-y-1/2 flex-row-reverse",
  "right-full mr-3 top-1/2 -translate-y-1/2 flex-row-reverse",
  "left-full ml-3 top-1/2 -translate-y-1/2 flex-row",
  "left-full ml-3 top-1/2 -translate-y-1/2 flex-row",
  "left-full ml-3 top-1/2 -translate-y-1/2 flex-row",
];

// 合計点バッジ
const TotalPointsBadge = ({ total }: { total: number }) => (
  <div className="shrink-0 whitespace-nowrap rounded-full bg-slate-900/90 px-3 py-1 text-sm font-bold text-white shadow-lg ring-1 ring-slate-500">
    {total}点
  </div>
);

// 縮小カード（Cardを半分のサイズで表示）
const MiniCard = ({ card }: { card: ClientCard }) => (
  <div className="relative h-[55px] w-[39px] shrink-0 [&:not(:first-child)]:-ml-4">
    <div className="absolute top-0 left-0 origin-top-left scale-50">
      <Card card={card} showPoints />
    </div>
  </div>
);

/**
 * 公開された手札（上がり・ドボン・ドボン返し時）
 * 席の表示位置に応じて、テーブル側に手札と合計点を表示する
 */
export const RevealedHand = ({ cards, displayIndex }: Props) => {
  const total = cards.reduce((sum, card) => sum + card.points, 0);
  const position = handPositions[displayIndex] ?? handPositions[0];
  const isMe = displayIndex === 3;

  // 1行あたりCARDS_PER_ROW枚で分割
  const sorted = sortCards(cards);
  const rows: ClientCard[][] = [];
  for (let i = 0; i < sorted.length; i += CARDS_PER_ROW) {
    rows.push(sorted.slice(i, i + CARDS_PER_ROW));
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 flex items-center gap-2",
        position,
      )}
    >
      {!isMe && (
        <div className="flex flex-col gap-1 rounded-lg bg-slate-900/60 p-1.5 shadow-lg">
          {rows.map((row) => (
            <div className="flex" key={row[0].id}>
              {row.map((card, index) => (
                <MiniCard card={card} key={`${card.id}-${index}`} />
              ))}
            </div>
          ))}
        </div>
      )}
      <TotalPointsBadge total={total} />
    </div>
  );
};
