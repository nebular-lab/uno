import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { currentAnimationAtom } from "@/atoms/animationAtoms";
import { selectedCardIdsAtom } from "@/atoms/selectedCardAtom";
import { ActionButtons } from "@/components/game/ActionButtons";
import { CountdownOverlay } from "@/components/game/CountdownOverlay";
import { FieldCard } from "@/components/game/FieldCard";
import { MyHand } from "@/components/game/MyHand";
import { EmptySeat, PlayerSeat } from "@/components/game/PlayerSeat";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { TurnDirectionIndicator } from "@/components/game/TurnDirectionIndicator";
import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";
import type { ClientCard } from "@/types/connection";

export const GameScreen = () => {
  const {
    players,
    mySeatIndex,
    phase,
    countdown,
    fieldCards,
    lastPlayedCount,
    deckCount,
    currentTurnPlayerId,
    myHand,
    turnDirection,
    playCard,
    leaveRoom,
  } = useGameRoom();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useAtom(selectedCardIdsAtom);
  const currentAnimation = useAtomValue(currentAnimationAtom);

  // アニメーション中は前の状態を保持するための参照
  const displayedFieldCardsRef = useRef<{
    cards: ClientCard[];
    lastPlayedCount: number;
  }>({ cards: [], lastPlayedCount: 1 });

  // 表示用の場札を計算（アニメーション中は更新しない）
  const displayedFieldCards = useMemo(() => {
    if (currentAnimation) {
      // アニメーション中は前の状態を維持
      return displayedFieldCardsRef.current;
    }
    // アニメーション完了後に更新
    return { cards: fieldCards, lastPlayedCount };
  }, [currentAnimation, fieldCards, lastPlayedCount]);

  // アニメーションが終わったら表示用の状態を更新
  useEffect(() => {
    if (!currentAnimation) {
      displayedFieldCardsRef.current = { cards: fieldCards, lastPlayedCount };
    }
  }, [currentAnimation, fieldCards, lastPlayedCount]);

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
    playCard(selectedCardIds);
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

      {/* ターン方向表示 */}
      {(phase === "revealing" || phase === "playing") && (
        <div className="absolute inset-x-0 top-12 mx-auto h-[360px] w-[900px]">
          <TurnDirectionIndicator direction={turnDirection} />
        </div>
      )}

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

      {/* 場のカード（テーブル中央、重ね出し対応） */}
      {(phase === "revealing" || phase === "playing") &&
        displayedFieldCards.cards.length > 0 && (
          <div className="absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center gap-2">
              {displayedFieldCards.cards
                .slice(-displayedFieldCards.lastPlayedCount)
                .map((card, index) => {
                  // 強制色変えの重ね出し時、最初のカードを強調
                  const isFirstForceChange =
                    index === 0 &&
                    displayedFieldCards.lastPlayedCount > 1 &&
                    card.value === "force-change";
                  return (
                    <FieldCard
                      card={card}
                      isHighlighted={isFirstForceChange}
                      isTopCard={index === displayedFieldCards.lastPlayedCount - 1}
                      key={card.id}
                    />
                  );
                })}
            </div>
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
        className="absolute left-4 top-4 size-[78px] bg-slate-700 text-white hover:bg-slate-600"
        onClick={() => setShowLeaveDialog(true)}
        variant="ghost"
      >
        退席
      </Button>

      {/* 退席確認ダイアログ */}
      {showLeaveDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[480px] rounded-xl border border-slate-600 bg-slate-800 p-9 shadow-xl">
            <h2 className="text-2xl font-semibold text-white">退席確認</h2>
            <p className="mt-3 text-base text-slate-300">
              ゲームから退席しますか？
            </p>
            <div className="mt-8 flex justify-end gap-4">
              <Button
                className="h-12 px-6 text-base border-slate-500 bg-slate-700 text-slate-200 hover:bg-slate-600"
                onClick={() => setShowLeaveDialog(false)}
                variant="outline"
              >
                キャンセル
              </Button>
              <Button
                className="h-12 px-6 text-base bg-red-500 text-white hover:bg-red-400"
                onClick={() => {
                  leaveRoom();
                  setShowLeaveDialog(false);
                }}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </TableContainer>
  );
};
