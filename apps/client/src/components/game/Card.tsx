import type { ClientCard } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  card: ClientCard;
  disabled?: boolean;
  onClick?: () => void;
};

// カードの色に対応するTailwindクラス
const colorClasses: Record<string, string> = {
  red: "bg-red-500 border-red-600",
  blue: "bg-blue-500 border-blue-600",
  green: "bg-green-500 border-green-600",
  yellow: "bg-yellow-400 border-yellow-500",
  wild: "bg-gradient-to-br from-red-500 via-blue-500 to-green-500 border-gray-600",
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
      return "FC";
    default:
      return value;
  }
};

export const Card = ({ card, disabled, onClick }: Props) => {
  const colorClass = colorClasses[card.color] ?? colorClasses.wild;
  const displayValue = getDisplayValue(card.value);

  return (
    <button
      className={cn(
        "relative flex h-20 w-14 items-center justify-center rounded-lg border-2 text-lg font-bold text-white shadow-lg transition-transform",
        colorClass,
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:-translate-y-2 hover:shadow-xl",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {/* 左上の小さい値 */}
      <span className="absolute left-1 top-1 text-xs">{displayValue}</span>
      {/* 中央の値 */}
      <span className="text-2xl">{displayValue}</span>
      {/* 右下の小さい値 */}
      <span className="absolute bottom-1 right-1 rotate-180 text-xs">
        {displayValue}
      </span>
    </button>
  );
};
