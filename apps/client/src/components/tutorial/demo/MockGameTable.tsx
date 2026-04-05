import type { ReactNode } from "react";
import { Card } from "@/components/game/Card";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { MockPlayerSeat } from "./MockPlayerSeat";
import { SlideCard } from "./SlideCard";

export interface MockPlayer {
  name: string;
  cardCount: number;
  isCurrentTurn?: boolean;
  label?: { text: string; color: string; textColor?: string };
  handPoints?: { value: number; opacity: number };
  scoreChange?: { value: number; opacity: number };
}

export interface MockHandCard {
  color: string;
  value: string;
  points: number;
  playable?: boolean;
}

interface MockGameTableProps {
  /** 6要素の配列。使わない席はnull。 */
  players: (MockPlayer | null)[];
  fieldCard?: { color: string; value: string };
  deckCount?: number;
  myHand?: MockHandCard[];
  totalPoints?: number;
  children?: ReactNode;
}

// ゲーム画面のベースサイズ（ScalableContainerと同じ）
const BASE_WIDTH = 1250;
const BASE_HEIGHT = Math.round(BASE_WIDTH / (19 / 9)); // ≈592

// Remotion動画サイズ（960x540）に合わせたスケール
// 字幕バー(70px)を除いた領域に収める
const DEMO_HEIGHT = 470;
const SCALE = Math.min(960 / BASE_WIDTH, DEMO_HEIGHT / BASE_HEIGHT);

export function MockGameTable({
  players,
  fieldCard,
  deckCount,
  myHand,
  totalPoints,
  children,
}: MockGameTableProps) {
  return (
    <div
      style={{
        width: BASE_WIDTH * SCALE,
        height: BASE_HEIGHT * SCALE,
        position: "relative",
      }}
    >
      <div
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        <TableContainer>
          {/* テーブル */}
          <div className="absolute inset-x-0 top-20 mx-auto size-fit">
            <Table />
          </div>

          {/* プレイヤーシート（6席） */}
          {players.map((player, i) => {
            if (!player) return null;
            return (
              <MockPlayerSeat
                cardCount={player.cardCount}
                displayIndex={i}
                handPoints={player.handPoints}
                isCurrentTurn={player.isCurrentTurn}
                key={player.name}
                label={player.label}
                name={player.name}
                scoreChange={player.scoreChange}
              />
            );
          })}

          {/* 山札 */}
          {deckCount !== undefined && (
            <div className="absolute left-[calc(50%-120px)] top-[42%] z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="flex size-16 items-center justify-center rounded-full bg-slate-700 border-2 border-slate-500 shadow-lg">
                <span className="font-bold text-white text-xl">
                  {deckCount}
                </span>
              </div>
            </div>
          )}

          {/* 場のカード */}
          {fieldCard && (
            <div className="absolute left-1/2 top-[42%] z-10 -translate-x-1/2 -translate-y-1/2">
              <SlideCard color={fieldCard.color} value={fieldCard.value} />
            </div>
          )}

          {/* 合計点数表示 */}
          {totalPoints !== undefined && (
            <div className="fixed bottom-[150px] left-4">
              <div className="flex size-[80px] flex-col items-center justify-center rounded-md bg-black/50 text-white">
                <span className="text-xs text-zinc-400">合計</span>
                <span className="text-2xl font-bold">{totalPoints}</span>
              </div>
            </div>
          )}

          {/* 自分の手札 */}
          {myHand && myHand.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="mx-auto flex w-fit gap-0.5 px-1">
                {myHand.map((card, i) => (
                  <Card
                    card={{
                      id: `tutorial-${i}`,
                      color: card.color,
                      value: card.value,
                      points: card.points,
                    }}
                    disabled={card.playable === undefined}
                    key={`${card.color}-${card.value}-${i}`}
                    playable={card.playable ?? true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 追加要素（アニメーション用カード等） */}
          {children}
        </TableContainer>
      </div>
    </div>
  );
}
