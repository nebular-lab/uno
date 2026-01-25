import type { ClientCard } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  card: ClientCard;
  disabled?: boolean;
  draggable?: boolean;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

// カードの色に対応するTailwindクラス（背景色のみ）
const bgColorClasses: Record<string, string> = {
  red: "bg-red-500 border-red-600",
  blue: "bg-blue-500 border-blue-600",
  green: "bg-green-600 border-green-700",
  yellow: "bg-yellow-400 border-yellow-500",
};

// テキスト色クラス
const textColorClasses: Record<string, string> = {
  red: "text-white",
  blue: "text-white",
  green: "text-white",
  yellow: "text-black",
};

// カードの値の表示
const getDisplayValue = (value: string): string => {
  switch (value) {
    case "skip":
      return "\u29B8"; // ⦸
    case "reverse":
      return "\u21C4"; // ⇄
    case "draw2":
      return "+2";
    case "wild":
      return "W";
    case "draw4":
      return "+4";
    case "force-change":
      return "W";
    default:
      return value;
  }
};

export const Card = ({
  card,
  disabled,
  draggable,
  playable = true,
  selected,
  onClick,
}: Props) => {
  const isDraw4 = card.value === "draw4";
  const isWild = card.value === "wild";

  // 背景クラスの決定
  const getBgClass = () => {
    if (isWild || isDraw4) return "bg-gray-500 border-gray-600";
    return bgColorClasses[card.color] ?? "bg-gray-500 border-gray-600";
  };

  // テキスト色の決定
  const getTextClass = () => {
    if (isWild || isDraw4) return "text-white";
    return textColorClasses[card.color] ?? "text-white";
  };

  const displayValue = getDisplayValue(card.value);

  // 出せないカードかどうか
  const isUnplayable = !disabled && !playable;

  return (
    <button
      className={cn(
        "relative flex h-[110px] w-[78px] select-none items-center justify-center rounded-lg text-lg font-bold shadow-lg transition-transform",
        getBgClass(),
        getTextClass(),
        disabled
          ? "cursor-not-allowed border-2 opacity-70"
          : isUnplayable
            ? "cursor-not-allowed border-2 opacity-30"
            : draggable
              ? "cursor-grab border-2 active:cursor-grabbing"
              : "cursor-pointer border-2 hover:border-4 hover:border-white",
        draggable && "pointer-events-none",
        selected && "border-4 border-white",
      )}
      disabled={disabled || isUnplayable}
      onClick={onClick}
      type="button"
    >
      {/* 中央の値 */}
      <span className="text-5xl">{displayValue}</span>
    </button>
  );
};
