import { useState } from "react";
import {
  EmptySeat,
  type Player,
  PlayerSeat,
} from "@/components/game/PlayerSeat";
import { Table } from "@/components/game/Table";
import { TableContainer } from "@/components/game/TableContainer";
import { Button } from "@/components/ui/button";

type Props = {
  roomId: string;
};

// モックデータ（後で実際のデータに置き換え）
// nullは空席を表す
const mockPlayers: (Player | null)[] = [
  { seatIndex: 0, name: "Player 1", cardCount: 0, isHost: true, isReady: true },
  { seatIndex: 1, name: "Player 2", cardCount: 0, isReady: true },
  null, // 空席
  { seatIndex: 3, name: "You", cardCount: 0, isReady: true },
  null, // 空席
  { seatIndex: 5, name: "Player 6", cardCount: 0, isReady: false },
];

export const WaitingRoomScreen = ({ roomId }: Props) => {
  // 自分のプレイヤーインデックス（後で実際のデータに置き換え）
  const myPlayerIndex = 3;

  // Ready状態（後で実際のデータに置き換え）
  const [isReady, setIsReady] = useState(false);

  const handleToggleReady = () => {
    setIsReady((prev) => !prev);
  };

  const handleLeaveRoom = () => {
    // TODO: 退席処理を実装
    console.log("Leave room");
  };

  return (
    <TableContainer>
      {/* テーブル（プレイヤー配置に合わせて配置） */}
      <div className="absolute top-12 inset-x-0 mx-auto size-fit">
        <Table />
      </div>

      {/* プレイヤーシート */}
      {mockPlayers.map((player, seatIndex) =>
        player ? (
          <PlayerSeat
            isCurrentPlayer={player.seatIndex === myPlayerIndex}
            key={`seat-${player.seatIndex}`}
            player={player}
          />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 席の順序は固定のためindexをキーとして使用
          <EmptySeat key={`empty-seat-${seatIndex}`} seatIndex={seatIndex} />
        ),
      )}

      {/* ルームID表示 */}
      <div className="absolute top-4 left-4 rounded bg-slate-800/80 px-3 py-1 text-sm text-white">
        Room: {roomId}
      </div>

      {/* 退席ボタン（左下） */}
      <div className="absolute bottom-4 left-4">
        <Button onClick={handleLeaveRoom} size="lg" variant="secondary">
          退席
        </Button>
      </div>

      {/* Ready/Waiting切り替えボタン（右下） */}
      <div className="absolute bottom-4 right-4">
        <Button onClick={handleToggleReady} size="lg" variant="default">
          {isReady ? "Waiting" : "Ready"}
        </Button>
      </div>
    </TableContainer>
  );
};
