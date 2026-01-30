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
  isSelf,
  duration,
}: {
  card: { id: string; color: string; value: string };
  index: number;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  isSelf: boolean;
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

  // スケール計算
  // 自分のカード: 手札サイズ(78x110)から場札サイズ(56x80)へ
  // 他プレイヤー: 小さいサイズから場札サイズへ
  const startScale = isSelf ? 1.0 : 0.5;
  const endScale = 56 / 78; // 場札/手札の比率

  const totalDuration = duration / 1000;
  const scalePhaseRatio = 0.3; // 最初の30%でスケール変更

  return (
    <motion.div
      animate={{
        // キーフレーム: [開始, スケール完了, 移動完了]
        x: [0, 0, deltaX + index * 4],
        y: [0, 0, deltaY],
        scale: [startScale, endScale, endScale],
        opacity: [isSelf ? 1 : 0, 1, 1],
        rotate: [index * 5, index * 3, index * 3],
      }}
      className="absolute"
      exit={{ opacity: 0 }}
      key={card.id}
      style={{
        left: startPos.x - 39, // カード幅の半分
        top: startPos.y - 55, // カード高さの半分
        transformOrigin: "center center",
      }}
      transition={{
        duration: totalDuration,
        ease: "easeOut",
        delay: index * 0.05,
        // 各プロパティのタイミングを制御
        times: [0, scalePhaseRatio, 1],
      }}
    >
      <div
        className={cn(
          "flex h-[110px] w-[78px] items-center justify-center rounded-lg border-2 text-lg font-bold shadow-lg",
          getBgClass(),
          getTextClass(),
        )}
      >
        <span className="text-5xl">{displayValue}</span>
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
            isSelf={animation.isSelf}
            key={card.id}
            startPos={startPos}
          />
        ))}
      </div>
    </AnimatePresence>
  );
};
