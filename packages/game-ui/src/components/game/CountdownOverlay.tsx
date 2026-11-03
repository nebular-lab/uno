import { AnimatePresence, motion } from "motion/react";

type Props = {
  count: number;
};

export const CountdownOverlay = ({ count }: Props) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.span
          animate={{ scale: 1, opacity: 1 }}
          className="font-bold text-9xl text-white drop-shadow-lg"
          exit={{ scale: 1.5, opacity: 0 }}
          initial={{ scale: 0.5, opacity: 0 }}
          key={count}
          transition={{ duration: 0.3 }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
