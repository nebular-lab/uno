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
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ArrowUpDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { setCardPositionAtom } from "@/atoms/cardPositionAtom";
import {
  orderedMyHandAtom,
  sortHandAtom,
  updateHandOrderAtom,
} from "@/atoms/handOrderAtom";
import { selectedCardIdsAtom } from "@/atoms/selectedCardAtom";
import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";
import type { ClientCard } from "@/types/connection";
import { Card } from "./Card";

type SortableCardProps = {
  card: ClientCard;
  disabled: boolean;
  playable: boolean;
  scale: number;
  selected: boolean;
  selectionOrder?: number;
  onCardClick: () => void;
  onPositionUpdate: (cardId: string, x: number, y: number) => void;
};

const SortableCard = ({
  card,
  disabled,
  playable,
  scale,
  selected,
  selectionOrder,
  onCardClick,
  onPositionUpdate,
}: SortableCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
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

  // カードの位置を報告（継続的に更新）
  useEffect(() => {
    const updatePosition = () => {
      if (cardRef.current && !isDragging) {
        const rect = cardRef.current.getBoundingClientRect();
        onPositionUpdate(
          card.id,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
      }
    };

    updatePosition();
    // レイアウト変更時に位置を再計算
    const observer = new ResizeObserver(updatePosition);
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    window.addEventListener("resize", updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [card.id, isDragging, onPositionUpdate]);

  // 複数のrefを結合
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [setNodeRef],
  );

  return (
    <div ref={setRefs} style={style} {...attributes} {...listeners}>
      <Card
        card={card}
        disabled={disabled}
        draggable={isDragging}
        onClick={onCardClick}
        playable={playable}
        selected={selected}
        selectionOrder={selectionOrder}
      />
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
  const setCardPosition = useSetAtom(setCardPositionAtom);
  const [selectedCardIds, setSelectedCardIds] = useAtom(selectedCardIdsAtom);
  const { playCard, playableCards } = useGameRoom();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // カード位置更新のコールバック
  const handlePositionUpdate = useCallback(
    (cardId: string, x: number, y: number) => {
      setCardPosition({ cardId, x, y });
    },
    [setCardPosition],
  );

  // 重ね出しできるカードを取得
  // force-changeは色が違っても重ね出し可能
  const getStackableCards = (card: ClientCard): ClientCard[] => {
    if (card.value === "force-change") {
      // force-changeは全ての force-change カードが重ね出し対象
      return cards.filter((c) => c.value === "force-change");
    }
    // それ以外は同色・同数字のみ
    return cards.filter(
      (c) => c.color === card.color && c.value === card.value,
    );
  };

  // カードが出せるかチェック
  const isPlayable = (cardId: string): boolean => {
    return playableCards[cardId] ?? false;
  };

  // 選択中のカードの最初のカードを取得
  const firstSelectedCard =
    selectedCardIds.length > 0
      ? cards.find((c) => c.id === selectedCardIds[0])
      : null;

  // カードが重ね出し選択可能かどうか
  const isStackSelectable = (card: ClientCard): boolean => {
    if (!firstSelectedCard) return false;
    if (firstSelectedCard.value === "force-change") {
      return card.value === "force-change";
    }
    return (
      card.color === firstSelectedCard.color &&
      card.value === firstSelectedCard.value
    );
  };

  // カードクリック時の処理
  const handleCardClick = (cardId: string) => {
    if (disabled) return;

    const clickedCard = cards.find((c) => c.id === cardId);
    if (!clickedCard) return;

    // 選択モード中の場合
    if (selectedCardIds.length > 0) {
      // 重ね出し可能なカードかチェック
      if (isStackSelectable(clickedCard)) {
        // 既に選択されていれば解除、されていなければ追加
        if (selectedCardIds.includes(cardId)) {
          // 最初のカードは解除できない（キャンセルボタンを使う）
          if (selectedCardIds[0] === cardId) return;
          setSelectedCardIds(selectedCardIds.filter((id) => id !== cardId));
        } else {
          setSelectedCardIds([...selectedCardIds, cardId]);
        }
      }
      return;
    }

    // 出せないカードは無視
    if (!isPlayable(cardId)) return;

    const stackableCards = getStackableCards(clickedCard);

    if (stackableCards.length === 1) {
      // 重ね出しできるカードが1枚だけなら直接出す
      playCard([cardId]);
      setSelectedCardIds([]);
    } else {
      // 複数枚ある場合は選択モードにする
      setSelectedCardIds([cardId]);
    }
  };

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
    <>
      <div className="fixed bottom-[150px] left-4 flex gap-2">
        <div className="flex size-[78px] flex-col items-center justify-center rounded-md bg-black/50 text-white">
          <span className="text-xs text-zinc-400">合計</span>
          <span className="text-2xl font-bold">{totalPoints}</span>
        </div>
        <Button
          className="size-[78px] bg-slate-700 border-2 border-slate-500 text-white hover:bg-slate-600"
          disabled={disabled || cards.length === 0}
          onClick={() => sortHand()}
          variant="ghost"
        >
          <ArrowUpDown className="size-5" />
        </Button>
      </div>
      <div
        className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2"
        ref={containerRef}
      >
        <div
          className="scrollbar-hide overflow-x-auto px-4 py-2"
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
              <div className="flex gap-0.5 px-1">
                {cards.map((card) => {
                  const selectionIndex = selectedCardIds.indexOf(card.id);
                  const isSelected = selectionIndex !== -1;
                  // force-changeの場合のみ選択順番を表示
                  const showOrder =
                    isSelected &&
                    firstSelectedCard?.value === "force-change" &&
                    selectedCardIds.length > 1;

                  return (
                    <SortableCard
                      card={card}
                      disabled={disabled}
                      key={card.id}
                      onCardClick={() => handleCardClick(card.id)}
                      onPositionUpdate={handlePositionUpdate}
                      playable={
                        selectedCardIds.length > 0
                          ? isStackSelectable(card)
                          : isPlayable(card.id)
                      }
                      scale={scale}
                      selected={isSelected}
                      selectionOrder={
                        showOrder ? selectionIndex + 1 : undefined
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </>
  );
};
