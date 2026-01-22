import { motion } from "motion/react";
import type { ClientCard } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  card: ClientCard;
  currentColor?: string; // force-change表示用
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

// 色の四角に使う背景色
const colorSquareClasses: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-600",
  yellow: "bg-yellow-400",
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

// Force Change用の色四角
const ForceChangeColorSquare = ({ color }: { color: string }) => (
  <div
    className={cn(
      "h-8 w-8 rounded border-2 border-white/50",
      colorSquareClasses[color] ?? "bg-gray-500",
    )}
  />
);

export const FieldCard = ({ card, currentColor }: Props) => {
  const isWild = card.value === "wild";
  const isDraw4 = card.value === "draw4";
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
    <motion.div
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      className={cn(
        "relative flex h-20 w-14 items-center justify-center rounded-lg border-2 text-lg font-bold shadow-lg",
        getBgClass(),
        getTextClass(),
      )}
      initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
    >
      {/* Force Changeの色四角 */}
      {isForceChange && currentColor && (
        <ForceChangeColorSquare color={currentColor} />
      )}

      {/* 中央の値（force-change以外） */}
      {!isForceChange && <span className="text-2xl">{displayValue}</span>}
    </motion.div>
  );
};
