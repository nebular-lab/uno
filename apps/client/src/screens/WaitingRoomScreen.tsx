import { EmptySeat, PlayerSeat } from "@/components/game/PlayerSeat";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { Button } from "@/components/ui/button";
import { useGameRoom } from "@/hooks/useGameRoom";
import { cn } from "@/lib/utils";

type Props = {
  roomId: string;
};

// 準備状態トグル
const ReadyToggle = ({
  isReady,
  onToggle,
}: {
  isReady: boolean;
  onToggle: () => void;
}) => {
  return (
    <button
      className={cn(
        "flex h-20 w-64 items-center justify-center gap-3 rounded-full px-6 text-lg font-medium transition-all",
        isReady
          ? "bg-green-600 text-white"
          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600",
      )}
      onClick={onToggle}
      type="button"
    >
      {/* チェックボックス風のインジケーター */}
      <div
        className={cn(
          "flex size-6 items-center justify-center rounded border-2 transition-colors",
          isReady
            ? "border-white bg-white text-green-600"
            : "border-zinc-400 bg-transparent",
        )}
      >
        {isReady && (
          <svg
            aria-label="チェック"
            className="size-4"
            fill="none"
            role="img"
            stroke="currentColor"
            strokeWidth={3}
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span>{isReady ? "準備完了" : "準備できたらタップ"}</span>
    </button>
  );
};

export const WaitingRoomScreen = ({ roomId }: Props) => {
  const {
    players,
    mySeatIndex,
    isReady,
    isHost,
    readyCount,
    toggleReady,
    leaveRoom,
  } = useGameRoom();

  // ゲーム開始可能かどうか（準備完了が3人以上）
  const canStartGame = readyCount >= 3;

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
            isCurrentPlayer={actualIndex === mySeatIndex}
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
        <Button className="h-20 px-10" onClick={leaveRoom} variant="secondary">
          退席
        </Button>
      </div>

      {/* 準備状態トグル・ゲーム開始ボタン（右下） */}
      <div className="absolute bottom-4 right-4 flex items-center gap-4">
        {isHost ? (
          <>
            <span
              className={cn(
                "text-sm",
                canStartGame ? "text-green-400" : "text-zinc-400",
              )}
            >
              {canStartGame
                ? "ゲームを開始できます！"
                : `あと${3 - readyCount}人の準備が必要`}
            </span>
            <Button
              className="h-20 px-8"
              disabled={!canStartGame}
              onClick={() => {
                // TODO: ゲーム開始イベントをサーバーに送る
              }}
            >
              ゲーム開始
            </Button>
          </>
        ) : (
          isReady && (
            <span className="text-sm text-zinc-400">
              ホストがゲームを開始するのをお待ちください
            </span>
          )
        )}
        <ReadyToggle isReady={isReady} onToggle={toggleReady} />
      </div>
    </TableContainer>
  );
};
