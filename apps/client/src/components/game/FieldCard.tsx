import { useSetAtom } from "jotai";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { fieldCardPositionAtom } from "@/atoms/cardPositionAtom";
import type { ClientCard } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  card: ClientCard;
  isTopCard?: boolean; // 一番上のカードかどうか（位置報告用）
  isHighlighted?: boolean; // 強調表示（強制色変えの最初のカード）
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

export const FieldCard = ({
  card,
  isTopCard = true,
  isHighlighted = false,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const setFieldCardPosition = useSetAtom(fieldCardPositionAtom);
  const isWild = card.value === "wild";
  const isDraw4 = card.value === "draw4";

  // 場札の位置を報告（一番上のカードのみ）
  useEffect(() => {
    if (!isTopCard) return;

    const updatePosition = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setFieldCardPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [setFieldCardPosition, isTopCard]);

  // 背景クラスの決定
  const getBgClass = () => {
    if (isWild || isDraw4) return "bg-gray-500 border-gray-600";
    // force-changeはカードの色を使用
    return bgColorClasses[card.color] ?? "bg-gray-500 border-gray-600";
  };

  // テキスト色の決定
  const getTextClass = () => {
    if (isWild || isDraw4) return "text-white";
    // force-changeはカードの色に応じたテキスト色を使用
    return textColorClasses[card.color] ?? "text-white";
  };

  const displayValue = getDisplayValue(card.value);

  return (
    <motion.div
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "relative flex h-20 w-14 items-center justify-center rounded-lg text-lg font-bold shadow-lg",
        getBgClass(),
        getTextClass(),
        isHighlighted
          ? "border-4 border-yellow-300 ring-2 ring-yellow-300/50"
          : "border-2",
      )}
      initial={{ scale: 0.95, opacity: 0.5 }}
      ref={ref}
      transition={{ duration: 0.15 }}
    >
      {/* 中央の値 */}
      <span className="text-2xl">{displayValue}</span>
      {/* 強調時のラベル */}
      {isHighlighted && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-black">
          色決め
        </div>
      )}
    </motion.div>
  );
};
