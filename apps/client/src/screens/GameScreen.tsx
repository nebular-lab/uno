import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { currentAnimationAtom } from "@/atoms/animationAtoms";
import { selectedCardIdsAtom } from "@/atoms/selectedCardAtom";
import { ActionButtons } from "@/components/game/ActionButtons";
import { CountdownOverlay } from "@/components/game/CountdownOverlay";
import { FieldCard } from "@/components/game/FieldCard";
import { MyHand } from "@/components/game/MyHand";
import { EmptySeat, PlayerSeat } from "@/components/game/PlayerSeat";
import { ScoreButton } from "@/components/game/ScoreButton";
import { ScorePanel } from "@/components/game/ScorePanel";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { TurnDirectionIndicator } from "@/components/game/TurnDirectionIndicator";
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
import type { ClientCard } from "@/types/connection";

// 選択可能な色（wildは除く）
type SelectableColor = "red" | "blue" | "green" | "yellow";

// 色ボタンの背景色
const colorButtonClasses: Record<SelectableColor, string> = {
  red: "bg-red-500 hover:bg-red-600",
  blue: "bg-blue-500 hover:bg-blue-600",
  green: "bg-green-600 hover:bg-green-700",
  yellow: "bg-yellow-400 hover:bg-yellow-500 text-black",
};

// 色インジケーターの背景色
const colorIndicatorClasses: Record<SelectableColor, string> = {
  red: "bg-red-500 border-red-300",
  blue: "bg-blue-500 border-blue-300",
  green: "bg-green-600 border-green-400",
  yellow: "bg-yellow-400 border-yellow-200",
};

export const GameScreen = () => {
  const {
    players,
    mySeatIndex,
    phase,
    countdown,
    fieldCards,
    lastPlayedCount,
    deckCount,
    drawStackCount,
    currentTurnPlayerId,
    currentColor,
    myHand,
    turnDirection,
    playCard,
    leaveRoom,
    canChooseColor,
    chooseColor,
    gameHistory,
    latestGameResult,
    isHost,
    startGame,
    playerCount,
  } = useGameRoom();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [showWinnerLabel, setShowWinnerLabel] = useState(false);

  // resultフェーズになったら、最初3秒は「上がり！」表示、その後スコアパネルを開く
  useEffect(() => {
    if (phase === "result") {
      setShowWinnerLabel(true);
      setShowScorePanel(false);

      const timer = setTimeout(() => {
        setShowWinnerLabel(false);
        setShowScorePanel(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [phase]);

  // waitingフェーズになったら自動でスコアパネルを閉じる
  useEffect(() => {
    if (phase === "waiting") {
      setShowScorePanel(false);
      setShowWinnerLabel(false);
    }
  }, [phase]);
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
        // 自分以外のプレイヤーが色を選択中かどうか
        const isOtherPlayerChoosingColor =
          displayIndex !== 3 && player?.canChooseColor === true;
        // resultフェーズで勝者かどうか（上がり表示中のみ）
        const isWinner =
          phase === "result" &&
          showWinnerLabel &&
          latestGameResult?.winnerId === player?.sessionId;
        return player ? (
          <PlayerSeat
            displayIndex={displayIndex}
            finishType={latestGameResult?.finishType}
            isChoosingColor={isOtherPlayerChoosingColor}
            isCurrentPlayer={isCurrentTurn}
            isPlaying={phase !== "waiting"}
            isWinner={isWinner}
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
        displayedFieldCards.cards.length > 0 &&
        (() => {
          const topCard =
            displayedFieldCards.cards[displayedFieldCards.cards.length - 1];
          const isWildOrDraw4 =
            topCard?.value === "wild" || topCard?.value === "draw4";
          // 誰かが色選択中かどうか（自分または他のプレイヤー）
          const isAnyoneChoosingColor = players.some(
            (p) => p?.canChooseColor === true,
          );
          const showColorIndicator =
            isWildOrDraw4 && currentColor && !isAnyoneChoosingColor;

          return (
            <div className="absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
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
                          isTopCard={
                            index === displayedFieldCards.lastPlayedCount - 1
                          }
                          key={card.id}
                        />
                      );
                    })}
                </div>
                {/* 選択された色の表示（カードの上） */}
                {showColorIndicator && (
                  <div
                    className={`absolute -top-6 left-1/2 -translate-x-1/2 h-4 w-10 rounded-full border-2 shadow ${colorIndicatorClasses[currentColor as SelectableColor]}`}
                  />
                )}
              </div>
            </div>
          );
        })()}

      {/* 山札の残り枚数（テーブル左寄り、waitingフェーズでは非表示） */}
      {phase !== "waiting" && (
        <div className="absolute left-[calc(50%-120px)] top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex size-16 items-center justify-center rounded-full bg-slate-700 border-2 border-slate-500 shadow-lg">
            <span className="font-bold text-white text-xl">{deckCount}</span>
          </div>
        </div>
      )}

      {/* ドロースタック表示（テーブル右寄り、waitingフェーズでは非表示） */}
      {phase !== "waiting" && drawStackCount > 0 && (
        <div className="absolute left-[calc(50%+120px)] top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-600 border-2 border-red-400 shadow-lg">
            <span className="font-bold text-white text-xl">
              +{drawStackCount}
            </span>
          </div>
        </div>
      )}

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
              className="size-[80px] bg-blue-600 text-white hover:bg-blue-700"
              onClick={handlePlaySelected}
              variant="ghost"
            >
              <span className="text-lg font-bold">決定</span>
            </Button>
            <Button
              className="size-[80px] bg-gray-500/80 text-white hover:bg-gray-600"
              onClick={handleCancel}
              variant="ghost"
            >
              <span className="text-sm font-bold">キャンセル</span>
            </Button>
          </div>
        </div>
      )}

      {/* 色選択ボタン（プレイヤーシートの右側に横1列） */}
      {phase === "playing" && canChooseColor && (
        <div className="absolute top-91 left-[calc(50%+120px)]">
          <div className="absolute -top-8 left-0 text-white text-sm font-medium whitespace-nowrap">
            色を選択してください。
          </div>
          <div className="flex gap-1">
            {(["red", "blue", "green", "yellow"] as SelectableColor[]).map(
              (color) => (
                <Button
                  className={`size-[80px] ${colorButtonClasses[color]}`}
                  key={color}
                  onClick={() => chooseColor(color)}
                  variant="ghost"
                />
              ),
            )}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      {phase === "playing" && <ActionButtons />}

      {/* waitingフェーズ用UI */}
      {phase === "waiting" && (
        <>
          {/* ホストにはゲーム開始ボタン */}
          {isHost && (
            <div className="absolute bottom-4 right-4 flex items-center gap-4">
              <span
                className={
                  playerCount >= 3
                    ? "text-sm text-green-400"
                    : "text-sm text-slate-400"
                }
              >
                {playerCount >= 3
                  ? "ゲームを開始できます！"
                  : `あと${3 - playerCount}人の参加が必要です。`}
              </span>
              <Button
                className="h-20 px-8 text-lg bg-blue-600 hover:bg-blue-500 border-0 font-bold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                disabled={playerCount < 3}
                onClick={startGame}
              >
                ゲーム開始
              </Button>
            </div>
          )}
          {/* 非ホストには待機メッセージ */}
          {!isHost && (
            <div className="absolute bottom-4 right-4">
              <span className="text-sm text-slate-400">
                ホストがゲームを開始するのをお待ちください
              </span>
            </div>
          )}
        </>
      )}

      {/* 退席ボタン */}
      <Button
        className="absolute left-4 top-4 size-[80px] bg-slate-700 text-white hover:bg-slate-600"
        onClick={() => setShowLeaveDialog(true)}
        variant="ghost"
      >
        退席
      </Button>

      {/* スコアボタン */}
      <ScoreButton onClick={() => setShowScorePanel(true)} />

      {/* 退席確認ダイアログ */}
      <Dialog onOpenChange={setShowLeaveDialog} open={showLeaveDialog}>
        <DialogContent className="w-[480px] p-9">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-white">
              退席確認
            </DialogTitle>
            <DialogDescription className="mt-3 text-base text-slate-300">
              ゲームから退席しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 grid grid-cols-2 gap-4">
            <Button
              className="h-20 text-2xl font-semibold border-slate-500 bg-gray-600 text-slate-200 hover:bg-gray-500"
              onClick={() => setShowLeaveDialog(false)}
              variant="outline"
            >
              キャンセル
            </Button>
            <Button
              className="h-20 text-2xl font-semibold bg-blue-600 text-white hover:bg-blue-500"
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

      {/* スコアパネル */}
      <ScorePanel
        gameHistory={gameHistory}
        isOpen={showScorePanel}
        onClose={() => setShowScorePanel(false)}
        players={players}
      />
    </TableContainer>
  );
};
