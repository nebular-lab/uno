import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  orderedMyHandAtom,
  sortHandAtom,
  updateHandOrderAtom,
} from "@/atoms/handOrderAtom";
import { Button } from "@/components/ui/button";
import type { ClientCard } from "@/types/connection";
import { Card } from "./Card";

type SortableCardProps = {
  card: ClientCard;
  disabled: boolean;
  scale: number;
};

const SortableCard = ({ card, disabled, scale }: SortableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: transform
      ? CSS.Transform.toString({ ...transform, x: transform.x / scale, y: 0 })
      : undefined,
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card card={card} disabled={disabled} draggable={isDragging} />
    </div>
  );
};

type Props = {
  disabled: boolean;
};

export const MyHand = ({ disabled }: Props) => {
  const cards = useAtomValue(orderedMyHandAtom);
  const sortHand = useSetAtom(sortHandAtom);
  const updateHandOrder = useSetAtom(updateHandOrderAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const scaleValue = getComputedStyle(
          containerRef.current,
        ).getPropertyValue("--container-scale");
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = cards.findIndex((card) => card.id === active.id);
    const newIndex = cards.findIndex((card) => card.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newCards = [...cards];
    const [movedCard] = newCards.splice(oldIndex, 1);
    newCards.splice(newIndex, 0, movedCard);

    updateHandOrder(newCards);
  };

  return (
    <div
      className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2"
      ref={containerRef}
    >
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
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={cards.map((card) => card.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-0.5">
              {cards.map((card) => (
                <SortableCard
                  card={card}
                  disabled={disabled}
                  key={card.id}
                  scale={scale}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
