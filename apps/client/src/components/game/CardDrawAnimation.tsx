import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { currentDrawAnimationAtom } from "@/atoms/animationAtoms";
import {
  deckPositionAtom,
  playerSeatPositionsAtom,
} from "@/atoms/cardPositionAtom";

/**
 * 山札からプレイヤーシートへのカード移動アニメーション
 */
export const CardDrawAnimation = () => {
  const animation = useAtomValue(currentDrawAnimationAtom);
  const deckPosition = useAtomValue(deckPositionAtom);
  const seatPositions = useAtomValue(playerSeatPositionsAtom);

  if (!animation) return null;
  if (!deckPosition) return null;

  const targetPosition = seatPositions[animation.displayIndex];
  if (!targetPosition) return null;

  // 差分を計算
  const deltaX = targetPosition.x - deckPosition.x;
  const deltaY = targetPosition.y - deckPosition.y;

  // カードサイズ
  const cardWidth = 40;
  const cardHeight = 56;

  const totalDuration = animation.duration / 1000;

  return (
    <AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-50">
        <motion.div
          animate={{
            x: [0, deltaX],
            y: [0, deltaY],
            scale: [1, 0.8],
            opacity: [1, 0],
          }}
          className="absolute"
          exit={{ opacity: 0 }}
          key={animation.id}
          style={{
            left: deckPosition.x - cardWidth / 2,
            top: deckPosition.y - cardHeight / 2,
            transformOrigin: "center center",
          }}
          transition={{
            duration: totalDuration,
            ease: "easeOut",
          }}
        >
          {/* カード裏面 */}
          <div
            className="flex items-center justify-center rounded-lg border-2 border-slate-500 bg-slate-700 shadow-lg"
            style={{
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
            }}
          >
            <div className="size-6 rounded-full bg-slate-600" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
