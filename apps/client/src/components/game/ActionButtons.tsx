import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";

// 選択可能な色（wildは除く）
type SelectableColor = "red" | "blue" | "green" | "yellow";

// 色ボタンの背景色
const colorButtonClasses: Record<SelectableColor, string> = {
  red: "bg-red-500 hover:bg-red-600",
  blue: "bg-blue-500 hover:bg-blue-600",
  green: "bg-green-600 hover:bg-green-700",
  yellow: "bg-yellow-400 hover:bg-yellow-500 text-black",
};

export const ActionButtons = () => {
  const {
    canDraw,
    canDrawStack,
    canChooseColor,
    canDobon,
    canDobonReturn,
    drawCard,
    drawStack,
    drawStackCount,
    dobon,
    dobonReturn,
    chooseColor,
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
          <span className="text-sm font-bold">{drawStackCount || 4}枚引く</span>
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
          <span className="text-sm font-bold">ドボン返し</span>
        </Button>
      )}
    </div>
  );
};
