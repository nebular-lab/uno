import { useAtom } from "jotai";
import { useState } from "react";
import { selectedCardIdsAtom } from "@/atoms/selectedCardAtom";
import { ActionButtons } from "@/components/game/ActionButtons";
import { CountdownOverlay } from "@/components/game/CountdownOverlay";
import { FieldCard } from "@/components/game/FieldCard";
import { MyHand } from "@/components/game/MyHand";
import { EmptySeat, PlayerSeat } from "@/components/game/PlayerSeat";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGameRoom } from "@/hooks/useGameRoom";

export const GameScreen = () => {
  const {
    players,
    mySeatIndex,
    phase,
    countdown,
    fieldCards,
    deckCount,
    currentColor,
    currentTurnPlayerId,
    myHand,
    playCard,
    leaveRoom,
  } = useGameRoom();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const [selectedCardIds, setSelectedCardIds] = useAtom(selectedCardIdsAtom);

  // 選択中の最初のカード情報
  const firstSelectedCard =
    selectedCardIds.length > 0
      ? myHand.find((c) => c.id === selectedCardIds[0])
      : null;

  // force-changeかどうか
  const isForceChange = firstSelectedCard?.value === "force-change";

  // 重ね出し可能なカードの枚数
  const stackableCardCount = firstSelectedCard
    ? isForceChange
      ? myHand.filter((c) => c.value === "force-change").length
      : myHand.filter(
          (c) =>
            c.color === firstSelectedCard.color &&
            c.value === firstSelectedCard.value,
        ).length
    : 0;

  // 決定ボタンで選択したカードを出す
  const handlePlaySelected = () => {
    if (selectedCardIds.length === 0) return;
    // 最初のカードIDと選択枚数を送信
    playCard(selectedCardIds[0], selectedCardIds.length);
    setSelectedCardIds([]);
  };

  // キャンセル
  const handleCancel = () => {
    setSelectedCardIds([]);
  };

  // 自分が下中央（position 3）に来るように回転
  const getActualIndex = (displayIndex: number): number => {
    if (mySeatIndex === -1) return displayIndex;
    return (displayIndex + mySeatIndex - 3 + 6) % 6;
  };

  return (
    <TableContainer>
      {/* テーブル */}
      <div className="absolute inset-x-0 top-12 mx-auto size-fit">
        <Table />
      </div>

      {/* プレイヤーシート */}
      {[0, 1, 2, 3, 4, 5].map((displayIndex) => {
        const actualIndex = getActualIndex(displayIndex);
        const player = players[actualIndex];
        const isCurrentTurn =
          player !== null && player.sessionId === currentTurnPlayerId;
        return player ? (
          <PlayerSeat
            displayIndex={displayIndex}
            isCurrentPlayer={isCurrentTurn}
            isPlaying={true}
            key={`seat-${actualIndex}`}
            player={player}
          />
        ) : (
          <EmptySeat
            displayIndex={displayIndex}
            key={`empty-seat-${actualIndex}`}
            seatIndex={actualIndex}
          />
        );
      })}

      {/* 場のカード（テーブル中央） */}
      {(phase === "revealing" || phase === "playing") &&
        fieldCards.length > 0 && (
          <div className="absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
            <FieldCard card={fieldCards[0]} currentColor={currentColor} />
          </div>
        )}

      {/* 山札の残り枚数（テーブル左寄り） */}
      <div className="absolute left-[calc(50%-120px)] top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="flex size-16 items-center justify-center rounded-full bg-slate-700 border-2 border-slate-500 shadow-lg">
          <span className="font-bold text-white text-xl">{deckCount}</span>
        </div>
      </div>

      {/* カウントダウン表示 */}
      {phase === "countdown" && countdown > 0 && (
        <CountdownOverlay count={countdown} />
      )}

      {/* 自分の手札 */}
      {phase !== "waiting" && <MyHand disabled={phase !== "playing"} />}

      {/* 重ね出し選択UI（プレイヤーシートの右側） */}
      {phase === "playing" && firstSelectedCard && stackableCardCount >= 2 && (
        <div className="absolute top-91 left-[calc(50%+100px)]">
          <div className="absolute -top-12 left-0 text-white text-sm font-medium whitespace-nowrap">
            <div>重ねだしするカードを選択して、決定ボタンを押してください</div>
            {isForceChange && (
              <div className="text-yellow-300">
                最初に選んだカードの色が適用されます
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              className="size-[78px] bg-blue-600 text-white hover:bg-blue-700"
              onClick={handlePlaySelected}
              variant="ghost"
            >
              <span className="text-lg font-bold">決定</span>
            </Button>
            <Button
              className="size-[78px] bg-gray-500/80 text-white hover:bg-gray-600"
              onClick={handleCancel}
              variant="ghost"
            >
              <span className="text-sm font-bold">キャンセル</span>
            </Button>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      {phase === "playing" && <ActionButtons />}

      {/* 退席ボタン */}
      <Button
        className="absolute left-4 top-4 bg-slate-700 text-white hover:bg-slate-600"
        onClick={() => setShowLeaveDialog(true)}
        variant="ghost"
      >
        退席
      </Button>

      {/* 退席確認ダイアログ */}
      <Dialog onOpenChange={setShowLeaveDialog} open={showLeaveDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">退席確認</DialogTitle>
            <DialogDescription className="text-slate-300">
              ゲームから退席しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => setShowLeaveDialog(false)}
              variant="outline"
            >
              キャンセル
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                leaveRoom();
                setShowLeaveDialog(false);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableContainer>
  );
};
