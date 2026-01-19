import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { navigateToCreateRoomAtom, playerAtom } from "../atoms/appAtoms";
import {
  connectToLobbyAtom,
  disconnectFromLobbyAtom,
  joinRoomAtom,
  lobbyStateAtom,
} from "../atoms/connectionAtoms";
import { RoomCard } from "../components/RoomCard";

export function LobbyScreen() {
  const player = useAtomValue(playerAtom);
  const lobbyState = useAtomValue(lobbyStateAtom);
  const connectToLobby = useSetAtom(connectToLobbyAtom);
  const disconnectFromLobby = useSetAtom(disconnectFromLobbyAtom);
  const joinRoom = useSetAtom(joinRoomAtom);
  const navigateToCreateRoom = useSetAtom(navigateToCreateRoomAtom);

  useEffect(() => {
    connectToLobby();
    return () => {
      disconnectFromLobby();
    };
  }, [connectToLobby, disconnectFromLobby]);

  const handleJoinRoom = (roomId: string) => {
    joinRoom(roomId);
  };

  const isLoading =
    lobbyState.status === "connecting" || lobbyState.status === "idle";
  const error = lobbyState.status === "error" ? lobbyState.error : null;
  const rooms = lobbyState.status === "connected" ? lobbyState.rooms : [];

  return (
    <div className="h-full flex flex-col bg-card text-foreground">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ロビー</h1>
          <span className="text-muted-foreground">{player?.name}</span>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-auto p-4">
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg">
            <span>{error}</span>
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">読み込み中...</span>
          </div>
        )}

        {/* ルーム一覧 */}
        {!isLoading && rooms.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">
              現在、開いているルームはありません
            </span>
          </div>
        )}

        {!isLoading && rooms.length > 0 && (
          <div className="flex flex-col gap-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.roomId}
                onJoin={() => handleJoinRoom(room.roomId)}
                room={room}
              />
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="p-4 border-t">
        <Button
          className="w-full text-lg py-6"
          onClick={navigateToCreateRoom}
          variant="outline"
        >
          ルームを作成
        </Button>
      </div>
    </div>
  );
}
