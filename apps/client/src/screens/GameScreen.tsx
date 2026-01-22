import { CountdownOverlay } from "@/components/game/CountdownOverlay";
import { FieldCard } from "@/components/game/FieldCard";
import { MyHand } from "@/components/game/MyHand";
import { EmptySeat, PlayerSeat } from "@/components/game/PlayerSeat";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { useGameRoom } from "@/hooks/useGameRoom";

type Props = {
  roomId: string;
};

export const GameScreen = ({ roomId }: Props) => {
  const {
    players,
    mySeatIndex,
    phase,
    countdown,
    fieldCards,
    deckCount,
    currentColor,
  } = useGameRoom();

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
        // TODO: 手番ハイライトの判定を改善（sessionIdが必要）
        const isCurrentTurn = false;
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

      {/* 山札と場札 */}
      <div className="absolute left-1/2 top-[42%] z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
        {/* 山札 */}
        <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-zinc-600 shadow-lg">
          <span className="font-bold text-white text-xl">{deckCount}</span>
        </div>

        {/* 場のカード */}
        {(phase === "revealing" || phase === "playing") &&
          fieldCards.length > 0 && (
            <FieldCard card={fieldCards[0]} currentColor={currentColor} />
          )}
      </div>

      {/* カウントダウン表示 */}
      {phase === "countdown" && countdown > 0 && (
        <CountdownOverlay count={countdown} />
      )}

      {/* 自分の手札 */}
      {phase !== "waiting" && <MyHand disabled={phase !== "playing"} />}

      {/* デバッグ情報 */}
      <div className="absolute left-4 top-4 rounded bg-slate-800/80 px-3 py-1 text-sm text-white">
        Room: {roomId} | Phase: {phase}
        {phase === "countdown" && ` | ${countdown}`}
      </div>
    </TableContainer>
  );
};
