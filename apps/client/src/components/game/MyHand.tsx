import { AnimatePresence, motion } from "motion/react";
import type { ClientCard } from "@/hooks/useGameRoom";
import { Card } from "./Card";

type Props = {
  cards: ClientCard[];
  disabled: boolean;
};

export const MyHand = ({ cards, disabled }: Props) => {
  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2">
      <AnimatePresence>
        {cards.map((card, index) => (
          <motion.div
            animate={{ y: 0, opacity: 1, rotateY: 0 }}
            initial={{ y: -100, opacity: 0, rotateY: 180 }}
            key={card.id}
            transition={{
              delay: index * 0.05,
              duration: 0.3,
              type: "spring",
              stiffness: 300,
            }}
          >
            <Card card={card} disabled={disabled} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
