import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { currentDrawAnimationAtom } from "@/atoms/animationAtoms";

/**
 * プレイヤーシート上の「+N」表示
 * 上に移動（フェードなし）
 */
export const DrawCountIndicator = () => {
  const animation = useAtomValue(currentDrawAnimationAtom);

  if (!animation) return null;

  // スナップショットとして保存された終了位置を使用
  const targetPosition = animation.endPosition;
  if (!targetPosition) return null;

  const totalDuration = animation.duration / 1000;

  return (
    <AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-50">
        <motion.div
          animate={{
            y: [0, -30],
          }}
          className="absolute"
          exit={{ opacity: 0 }}
          key={animation.id}
          style={{
            // バッジの上に表示（バッジ中心から上に35px程度オフセット）
            left: targetPosition.x,
            top: targetPosition.y - 35,
            transform: "translateX(-50%)",
          }}
          transition={{
            duration: totalDuration,
            ease: "easeOut",
          }}
        >
          <span className="rounded-full bg-blue-500 px-3 py-1 text-lg font-bold text-white shadow-lg">
            +{animation.cardCount}
          </span>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
