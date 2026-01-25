import { useAtom } from "jotai";
import {
  selectedCardIdAtom,
  selectedStackCountAtom,
} from "@/atoms/selectedCardAtom";
import { Button } from "@/components/ui/button";
import { type ClientCard, useGameRoom } from "@/hooks/useGameRoom";

// 選択可能な色（wildは除く）
type SelectableColor = "red" | "blue" | "green" | "yellow";

// 色ボタンの背景色
const colorButtonClasses: Record<SelectableColor, string> = {
  red: "bg-red-500 hover:bg-red-600",
  blue: "bg-blue-500 hover:bg-blue-600",
  green: "bg-green-600 hover:bg-green-700",
  yellow: "bg-yellow-400 hover:bg-yellow-500 text-black",
};

type Props = {
  myHand: ClientCard[];
};

export const ActionButtons = ({ myHand }: Props) => {
  const {
    canDraw,
    canDrawStack,
    canChooseColor,
    canDobon,
    canDobonReturn,
    playableCards,
    drawCard,
    drawStack,
    dobon,
    dobonReturn,
    chooseColor,
    playCard,
  } = useGameRoom();

  const [selectedCardId, setSelectedCardId] = useAtom(selectedCardIdAtom);
  const [selectedStackCount, setSelectedStackCount] = useAtom(
    selectedStackCountAtom,
  );

  // 選択中のカードを取得
  const selectedCard = myHand.find((c) => c.id === selectedCardId) ?? null;

  // 同じカード（同色・同数字）が何枚あるか計算
  const getSameCardCount = (card: ClientCard): number => {
    return myHand.filter(
      (c) => c.color === card.color && c.value === card.value,
    ).length;
  };

  const sameCardCount = selectedCard ? getSameCardCount(selectedCard) : 0;

  // カードを出す処理
  const handlePlayCard = () => {
    if (!selectedCardId) return;
    playCard(selectedCardId, selectedStackCount);
    setSelectedCardId(null);
    setSelectedStackCount(1);
  };

  // 選択したカードが出せるかどうか
  const canPlaySelectedCard = selectedCardId
    ? (playableCards[selectedCardId] ?? false)
    : false;

  return (
    <div className="fixed bottom-[150px] right-4 flex flex-col gap-2">
      {/* 重ね出し枚数選択（複数枚ある場合のみ） */}
      {selectedCard && sameCardCount >= 2 && (
        <>
          {Array.from({ length: sameCardCount }, (_, i) => i + 1).map(
            (count) => (
              <Button
                className={`size-[78px] text-white ${
                  selectedStackCount === count
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-black/50 hover:bg-black/70"
                }`}
                key={count}
                onClick={() => setSelectedStackCount(count)}
                variant="ghost"
              >
                <span className="text-lg font-bold">{count}枚</span>
              </Button>
            ),
          )}
          {/* カードを出すボタン */}
          <Button
            className="size-[78px] bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-500"
            disabled={!canPlaySelectedCard}
            onClick={handlePlayCard}
            variant="ghost"
          >
            <span className="text-lg font-bold">出す</span>
          </Button>
          {/* キャンセルボタン */}
          <Button
            className="size-[78px] bg-gray-500/80 text-white hover:bg-gray-600"
            onClick={() => {
              setSelectedCardId(null);
              setSelectedStackCount(1);
            }}
            variant="ghost"
          >
            <span className="text-sm font-bold">キャンセル</span>
          </Button>
        </>
      )}

      {/* 山札を引くボタン */}
      {canDraw && (
        <Button
          className="size-[78px] bg-black/50 text-white hover:bg-black/70"
          onClick={drawCard}
          variant="ghost"
        >
          <span className="text-lg font-bold">引く</span>
        </Button>
      )}

      {/* ドロースタックを引くボタン */}
      {canDrawStack && (
        <Button
          className="size-[78px] bg-red-500/80 text-white hover:bg-red-600"
          onClick={drawStack}
          variant="ghost"
        >
          <span className="text-sm font-bold">スタック</span>
          <span className="text-xs">を引く</span>
        </Button>
      )}

      {/* 色選択ボタン（2x2グリッド） */}
      {canChooseColor && (
        <div className="grid grid-cols-2 gap-1">
          {(["red", "blue", "green", "yellow"] as SelectableColor[]).map(
            (color) => (
              <Button
                className={`size-[37px] ${colorButtonClasses[color]}`}
                key={color}
                onClick={() => chooseColor(color)}
                variant="ghost"
              />
            ),
          )}
        </div>
      )}

      {/* ドボンボタン */}
      {canDobon && (
        <Button
          className="size-[78px] bg-purple-500/80 text-white hover:bg-purple-600"
          onClick={dobon}
          variant="ghost"
        >
          <span className="text-lg font-bold">ドボン</span>
        </Button>
      )}

      {/* ドボン返しボタン */}
      {canDobonReturn && (
        <Button
          className="size-[78px] bg-orange-500/80 text-white hover:bg-orange-600"
          onClick={dobonReturn}
          variant="ghost"
        >
          <span className="text-sm font-bold">ドボン</span>
          <span className="text-xs">返し</span>
        </Button>
      )}
    </div>
  );
};
