import { useAtom } from "jotai";
import { useState } from "react";
import { selectedCardIdAtom } from "@/atoms/selectedCardAtom";
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

  const [selectedCardId, setSelectedCardId] = useAtom(selectedCardIdAtom);

  // 選択中のカード情報
  const selectedCard = myHand.find((c) => c.id === selectedCardId) ?? null;
  const sameCardCount = selectedCard
    ? myHand.filter(
        (c) => c.color === selectedCard.color && c.value === selectedCard.value,
      ).length
    : 0;

  // 枚数を選択してカードを出す
  const handlePlayWithCount = (count: number) => {
    if (!selectedCardId) return;
    playCard(selectedCardId, count);
    setSelectedCardId(null);
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

      {/* 枚数選択ボタン（プレイヤーシートの右側） */}
      {phase === "playing" && selectedCard && sameCardCount >= 2 && (
        <div className="absolute top-91 left-[calc(50%+100px)]">
          <span className="absolute -top-8 left-0 text-white text-sm font-medium whitespace-nowrap">
            重ねて出す枚数を選択してください
          </span>
          <div className="flex gap-1">
            {Array.from({ length: sameCardCount }, (_, i) => i + 1).map(
              (count) => (
                <Button
                  className="size-[78px] bg-blue-600 text-white hover:bg-blue-700"
                  key={count}
                  onClick={() => handlePlayWithCount(count)}
                  variant="ghost"
                >
                  <span className="text-lg font-bold">{count}枚</span>
                </Button>
              ),
            )}
            <Button
              className="size-[78px] bg-gray-500/80 text-white hover:bg-gray-600"
              onClick={() => setSelectedCardId(null)}
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
