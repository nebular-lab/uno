import { EmptySeat, PlayerSeat } from "@/components/game/PlayerSeat";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  roomId: string;
};

export const WaitingRoomScreen = ({ roomId }: Props) => {
  const { players, mySeatIndex, isHost, playerCount, leaveRoom, startGame } =
    useGameRoom();

  // ゲーム開始可能かどうか（3人以上のプレイヤー）
  const canStartGame = playerCount >= 3;

  // 自分が下中央（position 3）に来るように回転
  // displayIndex: 画面上の表示位置（0-5）
  // actualIndex: 実際のプレイヤーの席番号
  const getActualIndex = (displayIndex: number): number => {
    if (mySeatIndex === -1) return displayIndex; // 自分がいない場合は回転なし
    return (displayIndex + mySeatIndex - 3 + 6) % 6;
  };

  return (
    <TableContainer>
      {/* テーブル（プレイヤー配置に合わせて配置） */}
      <div className="absolute top-12 inset-x-0 mx-auto size-fit">
        <Table />
      </div>

      {/* プレイヤーシート（0-5の表示位置、自分が下中央に来るよう回転） */}
      {[0, 1, 2, 3, 4, 5].map((displayIndex) => {
        const actualIndex = getActualIndex(displayIndex);
        const player = players[actualIndex];
        return player ? (
          <PlayerSeat
            displayIndex={displayIndex}
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

      {/* ルームID表示 */}
      <div className="absolute top-4 left-4 rounded bg-slate-800/80 px-3 py-1 text-sm text-white">
        Room: {roomId}
      </div>

      {/* 退席ボタン（左下） */}
      <div className="absolute bottom-4 left-4">
        <Button
          className="h-18 px-8 text-lg bg-slate-700 hover:bg-slate-600 border-0 font-bold text-slate-300 shadow-lg transition-all"
          onClick={leaveRoom}
        >
          退席
        </Button>
      </div>

      {/* ゲーム開始ボタン（右下、ホストのみ表示） */}
      {isHost && (
        <div className="absolute bottom-4 right-4 flex items-center gap-4">
          <span
            className={cn(
              "text-sm",
              canStartGame ? "text-green-400" : "text-slate-400",
            )}
          >
            {canStartGame
              ? "ゲームを開始できます！"
              : `あと${3 - playerCount}人必要`}
          </span>
          <Button
            className="h-18 px-8 text-lg bg-blue-600 hover:bg-blue-500 border-0 font-bold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            disabled={!canStartGame}
            onClick={startGame}
          >
            ゲーム開始
          </Button>
        </div>
      )}

      {/* 非ホストへのメッセージ */}
      {!isHost && (
        <div className="absolute bottom-4 right-4">
          <span className="text-sm text-slate-400">
            ホストがゲームを開始するのをお待ちください
          </span>
        </div>
      )}
    </TableContainer>
  );
};
