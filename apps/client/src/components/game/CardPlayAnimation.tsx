import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { currentAnimationAtom } from "@/atoms/animationAtoms";
import { fieldCardPositionAtom } from "@/atoms/cardPositionAtom";
import { cn } from "@/lib/utils";

// カードの色に対応するTailwindクラス
const bgColorClasses: Record<string, string> = {
  red: "bg-red-500 border-red-600",
  blue: "bg-blue-500 border-blue-600",
  green: "bg-green-600 border-green-700",
  yellow: "bg-yellow-400 border-yellow-500",
};

const textColorClasses: Record<string, string> = {
  red: "text-white",
  blue: "text-white",
  green: "text-white",
  yellow: "text-black",
};

const getDisplayValue = (value: string): string => {
  switch (value) {
    case "skip":
      return "\u29B8";
    case "reverse":
      return "\u21C4";
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

// アニメーション用カード表示
const AnimatedCard = ({
  card,
  index,
  startPos,
  endPos,
  duration,
}: {
  card: { id: string; color: string; value: string };
  index: number;
  startPos: { x: number; y: number; width: number; height: number };
  endPos: { x: number; y: number };
  duration: number;
}) => {
  const isDraw4 = card.value === "draw4";
  const isWild = card.value === "wild";

  const getBgClass = () => {
    if (isWild || isDraw4) return "bg-gray-500 border-gray-600";
    return bgColorClasses[card.color] ?? "bg-gray-500 border-gray-600";
  };

  const getTextClass = () => {
    if (isWild || isDraw4) return "text-white";
    return textColorClasses[card.color] ?? "text-white";
  };

  const displayValue = getDisplayValue(card.value);

  // 差分を計算
  const deltaX = endPos.x - startPos.x;
  const deltaY = endPos.y - startPos.y;

  // 実際のカードサイズを使用
  const { width, height } = startPos;

  // フォントサイズを幅に比例させる（場のカード基準: 幅56pxに対してtext-2xl=24px）
  const fontSize = (width / 56) * 24;

  const totalDuration = duration / 1000;

  return (
    <motion.div
      animate={{
        x: [0, deltaX + index * 4],
        y: [0, deltaY],
        rotate: [index * 5, index * 3],
      }}
      className="absolute"
      exit={{ opacity: 0 }}
      key={card.id}
      style={{
        left: startPos.x - width / 2,
        top: startPos.y - height / 2,
        transformOrigin: "center center",
      }}
      transition={{
        duration: totalDuration,
        ease: "easeOut",
        delay: index * 0.05,
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center border-2 font-bold shadow-lg",
          getBgClass(),
          getTextClass(),
        )}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          fontSize: `${fontSize}px`,
          // 場のカードと同じ比率の角丸（基準座標: 幅56pxに対して8px）
          borderRadius: `${(width / 56) * 8}px`,
        }}
      >
        <span>{displayValue}</span>
      </div>
    </motion.div>
  );
};

export const CardPlayAnimation = () => {
  const animation = useAtomValue(currentAnimationAtom);
  const fieldCardPosition = useAtomValue(fieldCardPositionAtom);

  if (!animation || animation.type !== "playCard") return null;

  // 場札の位置がない場合はアニメーションしない
  if (!fieldCardPosition) return null;

  // スナップショットとして保存された開始位置を使用
  const startPos = animation.startPosition;
  if (!startPos) return null;

  return (
    <AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-50">
        {animation.cards.map((card, index) => (
          <AnimatedCard
            card={card}
            duration={animation.duration}
            endPos={fieldCardPosition}
            index={index}
            key={card.id}
            startPos={startPos}
          />
        ))}
      </div>
    </AnimatePresence>
  );
};
