import type { ClientCard } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  card: ClientCard;
  disabled?: boolean;
  draggable?: boolean;
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
      return "";
    default:
      return value;
  }
};

export const Card = ({ card, disabled, draggable, onClick }: Props) => {
  const isDraw4 = card.value === "draw4";
  const isWild = card.value === "wild";
  const isForceChange = card.value === "force-change";

  // 背景クラスの決定
  const getBgClass = () => {
    if (isWild || isDraw4) return "bg-gray-500 border-gray-600";
    if (isForceChange) return "bg-gray-400 border-gray-500";
    return bgColorClasses[card.color] ?? "bg-gray-500 border-gray-600";
  };

  // テキスト色の決定
  const getTextClass = () => {
    if (isWild || isDraw4 || isForceChange) return "text-white";
    return textColorClasses[card.color] ?? "text-white";
  };

  const displayValue = getDisplayValue(card.value);

  return (
    <button
      className={cn(
        "relative flex h-20 w-14 select-none items-center justify-center rounded-lg border-2 text-lg font-bold shadow-lg transition-transform",
        getBgClass(),
        getTextClass(),
        disabled
          ? "cursor-not-allowed opacity-70"
          : draggable
            ? "cursor-grab active:cursor-grabbing"
            : "cursor-pointer hover:-translate-y-2 hover:shadow-xl",
        draggable && "pointer-events-none",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {/* 中央の値 */}
      <span className="text-2xl">{displayValue}</span>
    </button>
  );
};
