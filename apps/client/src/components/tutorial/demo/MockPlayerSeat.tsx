import { cn } from "@/lib/utils";

interface MockPlayerSeatProps {
  name: string;
  cardCount: number;
  isCurrentTurn?: boolean;
  label?: { text: string; color: string; textColor?: string };
  handPoints?: { value: number; opacity: number };
  scoreChange?: { value: number; opacity: number };
  displayIndex: number;
}

// PlayerSeat.tsx の座席位置を少し下にオフセット（チュートリアル用）
const seatPositions = [
  "top-14 left-1/2 -translate-x-1/2",
  "top-38 left-[85%] -translate-x-1/2",
  "top-78 left-[85%] -translate-x-1/2",
  "top-100 left-1/2 -translate-x-1/2",
  "top-78 left-[15%] -translate-x-1/2",
  "top-38 left-[15%] -translate-x-1/2",
];

const avatarPositions = [
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-right-1 -top-1 absolute z-30",
  "-right-1 -top-1 absolute z-30",
];

const namePositions = [
  "justify-center pl-[50px]",
  "justify-center pl-[50px]",
  "justify-center pl-[50px]",
  "justify-center pl-[50px]",
  "justify-center pr-[50px]",
  "justify-center pr-[50px]",
];

const labelPositions = [
  "left-[calc(50%+25px)]",
  "left-[calc(50%+25px)]",
  "left-[calc(50%+25px)]",
  "left-[calc(50%+25px)]",
  "left-[calc(50%-25px)]",
  "left-[calc(50%-25px)]",
];

export function MockPlayerSeat({
  name,
  cardCount,
  isCurrentTurn,
  label,
  handPoints,
  scoreChange,
  displayIndex,
}: MockPlayerSeatProps) {
  const seatPos = seatPositions[displayIndex];
  const avatarPos = avatarPositions[displayIndex];
  const namePos = namePositions[displayIndex];
  const labelPos = labelPositions[displayIndex];

  const borderClass = isCurrentTurn
    ? "border-2 border-yellow-400"
    : "border border-slate-600";

  return (
    <div className={cn("absolute size-fit", seatPos)}>
      {/* ラベル（上がり！ドボン！等） */}
      {label && (
        <div
          className={cn(
            "absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold shadow-lg z-20 animate-bounce",
            labelPos,
            label.textColor ?? "text-white",
          )}
          style={{ backgroundColor: label.color }}
        >
          {label.text}
        </div>
      )}

      {/* 点数変動 */}
      {scoreChange && scoreChange.value !== 0 && scoreChange.opacity > 0 && (
        <div
          className={cn(
            "absolute -top-12 -translate-x-1/2 whitespace-nowrap text-lg font-bold z-20",
            labelPos,
            scoreChange.value > 0 ? "text-green-400" : "text-red-400",
          )}
          style={{ opacity: scoreChange.opacity }}
        >
          {scoreChange.value > 0 ? `+${scoreChange.value}` : scoreChange.value}
        </div>
      )}

      {/* 名前プレート */}
      <div
        className={cn(
          namePos,
          "relative z-10 flex h-[60px] w-[200px] items-center gap-2 rounded-full border-2 bg-slate-800/80 backdrop-blur-sm shadow-lg transition-colors",
          isCurrentTurn ? "border-yellow-400" : "border-slate-600",
        )}
      >
        <div className="flex w-[150px] flex-col items-center justify-center">
          <span className="truncate text-white text-sm font-medium">
            {name}
          </span>
        </div>
      </div>

      {/* カード枚数バッジ */}
      <div className={cn(avatarPos)}>
        {/* 手札点数（バッジの上） */}
        {handPoints && handPoints.opacity > 0 && (
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white z-20"
            style={{ opacity: handPoints.opacity }}
          >
            {handPoints.value}点
          </div>
        )}
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-bold text-white shadow-lg",
            borderClass,
            cardCount === 1 ? "bg-red-500" : "bg-slate-700",
          )}
          style={{ width: 70, height: 70 }}
        >
          <span className="text-2xl">{cardCount}</span>
        </div>
      </div>
    </div>
  );
}
