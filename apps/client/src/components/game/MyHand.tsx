import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUpDown } from "lucide-react";
import { AnimatePresence, Reorder } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  orderedMyHandAtom,
  sortHandAtom,
  updateHandOrderAtom,
} from "@/atoms/handOrderAtom";
import { Button } from "@/components/ui/button";
import { Card } from "./Card";

type Props = {
  disabled: boolean;
};

export const MyHand = ({ disabled }: Props) => {
  const cards = useAtomValue(orderedMyHandAtom);
  const updateHandOrder = useSetAtom(updateHandOrderAtom);
  const sortHand = useSetAtom(sortHandAtom);
  const groupRef = useRef<HTMLUListElement>(null);
  const [scale, setScale] = useState(1);

  // 親コンテナのスケール値を取得
  useEffect(() => {
    const updateScale = () => {
      if (groupRef.current) {
        const scaleValue = getComputedStyle(groupRef.current).getPropertyValue(
          "--container-scale",
        );
        if (scaleValue) {
          setScale(Number.parseFloat(scaleValue));
        }
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const totalPoints = cards.reduce((sum, card) => sum + card.points, 0);

  return (
    <div className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2">
      <div className="absolute -top-24 left-4 flex gap-2">
        <Button
          className="size-[78px] bg-black/50 text-white hover:bg-black/70"
          disabled={disabled || cards.length === 0}
          onClick={() => sortHand()}
          variant="ghost"
        >
          <ArrowUpDown className="size-5" />
        </Button>
        <div className="flex size-[78px] flex-col items-center justify-center rounded-md bg-black/50 text-white">
          <span className="text-xs text-zinc-400">合計</span>
          <span className="text-2xl font-bold">{totalPoints}</span>
        </div>
      </div>
      <div
        className="scrollbar-hide overflow-x-auto px-4"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <Reorder.Group
          axis="x"
          className="flex gap-0.5"
          onReorder={updateHandOrder}
          ref={groupRef}
          values={cards}
        >
          <AnimatePresence>
            {cards.map((card) => (
              <Reorder.Item
                animate={{ y: 0, opacity: 1, rotateY: 0 }}
                drag={!disabled}
                dragTransition={{ power: 0, timeConstant: 0 }}
                initial={{ y: -100, opacity: 0, rotateY: 180 }}
                key={card.id}
                style={{
                  x: 0,
                  y: 0,
                  touchAction: "none",
                }}
                transformTemplate={(_, generated) => {
                  // スケールされた親内でのドラッグ座標を補正 + 縦方向の移動を無効化
                  const match = generated.match(
                    /translateX\(([^)]+)\) translateY\(([^)]+)\)/,
                  );
                  if (match) {
                    const x = Number.parseFloat(match[1]) / scale;
                    // Y座標は常に0に固定（横方向のみ移動可能）
                    return generated.replace(
                      /translateX\([^)]+\) translateY\([^)]+\)/,
                      `translateX(${x}px) translateY(0px)`,
                    );
                  }
                  return generated;
                }}
                value={card}
                whileDrag={{
                  zIndex: 50,
                  cursor: "grabbing",
                }}
              >
                <Card card={card} disabled={disabled} draggable />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>
    </div>
  );
};
