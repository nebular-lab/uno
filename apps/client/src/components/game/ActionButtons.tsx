import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";

export const ActionButtons = () => {
  const {
    canDraw,
    canDrawStack,
    canDobon,
    canDobonReturn,
    canPass,
    drawCard,
    drawStack,
    drawStackCount,
    dobon,
    dobonReturn,
    pass,
  } = useGameRoom();

  return (
    <div className="fixed bottom-[150px] right-4 flex gap-2">
      {/* 山札を引くボタン */}
      {canDraw && (
        <Button
          className="size-[78px] bg-amber-700 text-white hover:bg-amber-600"
          onClick={drawCard}
          variant="ghost"
        >
          <span className="text-sm font-bold">山札を引く</span>
        </Button>
      )}

      {/* ドロースタックを引くボタン */}
      {canDrawStack && (
        <Button
          className="size-[78px] bg-red-500/80 text-white hover:bg-red-600"
          onClick={drawStack}
          variant="ghost"
        >
          <span className="text-sm font-bold">{drawStackCount}枚引く</span>
        </Button>
      )}

      {/* パスボタン */}
      {canPass && (
        <Button
          className="size-[78px] bg-gray-500/80 text-white hover:bg-gray-600"
          onClick={pass}
          variant="ghost"
        >
          <span className="text-sm font-bold">パス</span>
        </Button>
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
          <span className="text-sm font-bold">ドボン返し</span>
        </Button>
      )}
    </div>
  );
};
