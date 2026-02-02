import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { playerSeatPositionsAtom } from "@/atoms/cardPositionAtom";
import { cn } from "@/lib/utils";
import type { ClientPlayer } from "@/types/connection";

type Props = {
  player: ClientPlayer;
  isCurrentPlayer?: boolean;
  displayIndex?: number; // 表示位置（回転後の位置）
  isPlaying?: boolean; // ゲーム中かどうか（trueの場合はカード枚数を表示）
  isChoosingColor?: boolean; // 色を選択中かどうか
  isWinner?: boolean; // 勝者かどうか（resultフェーズで表示）
};

// 6人の位置定義（0:上中央 → 時計回り）
// 横長画面: 1250 x 592 を想定、下にカード配置スペースを確保するため上寄せ
// すべて中央基準（-translate-x-1/2）で配置
const seatPositions = [
  "top-6 left-1/2 -translate-x-1/2", // 0: 上中央
  "top-30 left-[85%] -translate-x-1/2", // 1: 右上
  "top-70 left-[85%] -translate-x-1/2", // 2: 右下
  "top-92 left-1/2 -translate-x-1/2", // 3: 下中央
  "top-70 left-[15%] -translate-x-1/2", // 4: 左下
  "top-30 left-[15%] -translate-x-1/2", // 5: 左上
];

// アバター位置（名前プレートの左右どちらにつけるか）
const avatarPositions = [
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-right-1 -top-1 absolute z-30",
  "-right-1 -top-1 absolute z-30",
];

// 名前プレートの位置調整（丸がない部分の中央に名前を配置）
// displayIndex 0-3: 丸が左側なので左パディング
// displayIndex 4-5: 丸が右側なので右パディング
const namePositions = [
  "justify-center pl-[50px]",
  "justify-center pl-[50px]",
  "justify-center pl-[50px]",
  "justify-center pl-[50px]",
  "justify-center pr-[50px]",
  "justify-center pr-[50px]",
];

// ラベル（タイマー、色選択中）の位置調整（丸がない部分の中央に配置）
// displayIndex 0-3: 丸が左側なので右に25pxオフセット
// displayIndex 4-5: 丸が右側なので左に25pxオフセット
const labelPositions = [
  "left-[calc(50%+25px)]",
  "left-[calc(50%+25px)]",
  "left-[calc(50%+25px)]",
  "left-[calc(50%+25px)]",
  "left-[calc(50%-25px)]",
  "left-[calc(50%-25px)]",
];

// 空席バッジ
const EmptyBadge = ({ size = 70 }: { size?: number }) => {
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 border-dashed border-slate-600 text-slate-500 text-xs font-medium"
      style={{ width: size, height: size }}
    >
      Empty
    </div>
  );
};

// 空席表示
export const EmptySeat = ({
  seatIndex,
  displayIndex,
}: {
  seatIndex: number;
  displayIndex?: number; // 表示位置（回転後の位置）
}) => {
  const posIndex = displayIndex ?? seatIndex;
  const seatPos = seatPositions[posIndex] ?? seatPositions[0];

  return (
    <div className={cn("absolute size-fit", seatPos)}>
      <EmptyBadge size={70} />
    </div>
  );
};

// プレイヤーステータスバッジ（カード枚数 + HOST表示）
const PlayerStatusBadge = ({
  isHost,
  isPlaying,
  isSpectator,
  isCurrentPlayer,
  cardCount,
  size = 70,
}: {
  isHost?: boolean;
  isPlaying?: boolean;
  isSpectator?: boolean;
  isCurrentPlayer?: boolean;
  cardCount: number;
  size?: number;
}) => {
  const borderClass = isCurrentPlayer
    ? "border-2 border-yellow-400"
    : "border border-slate-600";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {isPlaying ? (
        isSpectator ? (
          // ゲーム中の観戦者: 「待機中」を表示
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-slate-600 text-white text-xs font-medium shadow-lg",
              borderClass,
            )}
            style={{ width: size, height: size }}
          >
            待機中
          </div>
        ) : (
          // ゲーム中: カード枚数を表示（残り1枚は赤、それ以外はスレート）
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-bold text-white shadow-lg",
              borderClass,
              cardCount === 1 ? "bg-red-500" : "bg-slate-700",
            )}
            style={{ width: size, height: size }}
          >
            <span className="text-2xl">{cardCount}</span>
          </div>
        )
      ) : (
        // 待機中: 何も表示しない（ステータス無し）
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-slate-700 shadow-lg",
            borderClass,
          )}
          style={{ width: size, height: size }}
        />
      )}
      {/* HOSTバッジ（待機室のみ表示） */}
      {isHost && !isPlaying && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-black shadow">
          HOST
        </div>
      )}
    </div>
  );
};

// タイマー表示
const TurnTimer = ({
  timeRemaining,
  displayIndex,
}: {
  timeRemaining: number;
  displayIndex: number;
}) => {
  if (timeRemaining <= 0) return null;

  // 残り3秒以下は赤、それ以外は黄色
  const isUrgent = timeRemaining <= 3;
  const labelPos = labelPositions[displayIndex] ?? labelPositions[0];

  return (
    <div
      className={cn(
        "absolute -bottom-5 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-bold shadow",
        labelPos,
        isUrgent
          ? "bg-red-500 text-white animate-pulse"
          : "bg-yellow-400 text-black",
      )}
    >
      {timeRemaining}s
    </div>
  );
};

// プレイヤー名プレート
const PlayerNamePlate = ({
  name,
  namePos,
  isCurrentPlayer,
  timeRemaining,
  displayIndex,
}: {
  name: string;
  namePos: string;
  isCurrentPlayer?: boolean;
  timeRemaining?: number;
  displayIndex: number;
}) => {
  return (
    <div
      className={cn(
        namePos,
        "relative z-10 flex h-[60px] w-[200px] items-center gap-2 rounded-full border-2 bg-slate-800/80 backdrop-blur-sm shadow-lg transition-colors",
        isCurrentPlayer ? "border-yellow-400" : "border-slate-600",
      )}
    >
      <div className="flex w-[150px] flex-col items-center justify-center">
        <span className="truncate text-white text-sm font-medium">{name}</span>
      </div>
      {isCurrentPlayer && timeRemaining !== undefined && (
        <TurnTimer displayIndex={displayIndex} timeRemaining={timeRemaining} />
      )}
    </div>
  );
};

// 勝者ラベル
const WinnerLabel = ({ displayIndex }: { displayIndex: number }) => {
  const labelPos = labelPositions[displayIndex] ?? labelPositions[0];
  return (
    <div
      className={cn(
        "absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black shadow-lg z-20 animate-bounce",
        labelPos,
      )}
    >
      上がり！
    </div>
  );
};

export const PlayerSeat = ({
  player,
  isCurrentPlayer,
  displayIndex,
  isPlaying,
  isChoosingColor,
  isWinner,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const setPlayerSeatPositions = useSetAtom(playerSeatPositionsAtom);
  const posIndex = displayIndex ?? player.seatIndex;
  const seatPos = seatPositions[posIndex] ?? seatPositions[0];
  const avatarPos = avatarPositions[posIndex] ?? avatarPositions[0];
  const namePos = namePositions[posIndex] ?? namePositions[0];

  // シート位置を報告
  useEffect(() => {
    const updatePosition = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setPlayerSeatPositions((prev) => ({
          ...prev,
          [posIndex]: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        }));
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [posIndex, setPlayerSeatPositions]);

  const labelPos = labelPositions[posIndex] ?? labelPositions[0];

  return (
    <div className={cn("absolute size-fit", seatPos)} ref={ref}>
      {/* 手番プレイヤーのパルスアニメーション */}
      {isCurrentPlayer && (
        <div
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] h-[80px] pointer-events-none z-0",
            labelPos,
          )}
        >
          <div className="turn-pulse-ring" />
        </div>
      )}
      {/* 勝者ラベル（上がり！） */}
      {isWinner && <WinnerLabel displayIndex={posIndex} />}
      {/* 色選択中ラベル */}
      {isChoosingColor && !isWinner && (
        <div
          className={cn(
            "absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black shadow z-20",
            labelPos,
          )}
        >
          色を選択中
        </div>
      )}
      <PlayerNamePlate
        displayIndex={posIndex}
        isCurrentPlayer={isCurrentPlayer}
        name={player.name}
        namePos={namePos}
        timeRemaining={player.timeRemaining}
      />
      <div className={cn(avatarPos)}>
        <PlayerStatusBadge
          cardCount={player.cardCount}
          isCurrentPlayer={isCurrentPlayer}
          isHost={player.isHost}
          isPlaying={isPlaying}
          isSpectator={player.isSpectator}
          size={70}
        />
      </div>
    </div>
  );
};
