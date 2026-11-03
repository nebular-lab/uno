import { useGameRoom } from "../../hooks/useGameRoom";
import { Button } from "../ui/button";

export const ActionButtons = () => {
  const {
    canDobon,
    canDraw,
    canDrawStack,
    canPass,
    drawCard,
    drawStack,
    drawStackCount,
    isSpectator,
    pass,
    skipDobon,
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

      {/* ドボンしないボタン（ドボンボタンは画面中央に表示する） */}
      {!isSpectator && canDobon && (
        <Button
          className="size-[80px] bg-gray-600/90 text-white hover:bg-gray-500"
          onClick={skipDobon}
          variant="ghost"
        >
          <span className="text-sm font-bold leading-tight">
            ドボン
            <br />
            しない
          </span>
        </Button>
      )}
    </div>
  );
};
