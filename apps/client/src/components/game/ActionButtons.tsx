import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";

export const ActionButtons = () => {
  const {
    canDraw,
    canDrawStack,
    canDobonReturn,
    canPass,
    drawCard,
    drawStack,
    drawStackCount,
    dobonReturn,
    pass,
  } = useGameRoom();

  return (
    <div className="fixed bottom-[150px] right-4 flex gap-2">
      {/* 山札を引くボタン */}
      {canDraw && (
        <Button
          className="size-[80px] bg-amber-700 text-white hover:bg-amber-600"
          onClick={drawCard}
          variant="ghost"
        >
          <span className="text-sm font-bold">山札を引く</span>
        </Button>
      )}

      {/* ドロースタックを引くボタン */}
      {canDrawStack && (
        <Button
          className="size-[80px] bg-red-500/80 text-white hover:bg-red-600"
          onClick={drawStack}
          variant="ghost"
        >
          <span className="text-sm font-bold">{drawStackCount}枚引く</span>
        </Button>
      )}

      {/* パスボタン */}
      {canPass && (
        <Button
          className="size-[80px] bg-gray-500/80 text-white hover:bg-gray-600"
          onClick={pass}
          variant="ghost"
        >
          <span className="text-sm font-bold">パス</span>
        </Button>
      )}

      {/* ドボン返しボタン */}
      {canDobonReturn && (
        <Button
          className="size-[80px] bg-orange-500/80 text-white hover:bg-orange-600"
          onClick={dobonReturn}
          variant="ghost"
        >
          <span className="text-sm font-bold">ドボン返し</span>
        </Button>
      )}
    </div>
  );
};
