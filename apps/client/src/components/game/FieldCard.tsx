import { motion } from "motion/react";
import type { ClientCard } from "@/hooks/useGameRoom";

type Props = {
  card: ClientCard;
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

export const FieldCard = ({ card }: Props) => {
  const colorClass = colorClasses[card.color] ?? colorClasses.wild;
  const displayValue = getDisplayValue(card.value);

  return (
    <motion.div
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      className={`relative flex h-20 w-14 items-center justify-center rounded-lg border-2 text-lg font-bold text-white shadow-lg ${colorClass}`}
      initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
    >
      {/* 左上の小さい値 */}
      <span className="absolute left-1 top-1 text-xs">{displayValue}</span>
      {/* 中央の値 */}
      <span className="text-2xl">{displayValue}</span>
      {/* 右下の小さい値 */}
      <span className="absolute bottom-1 right-1 rotate-180 text-xs">
        {displayValue}
      </span>
    </motion.div>
  );
};
