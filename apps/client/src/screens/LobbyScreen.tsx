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
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-foreground relative overflow-hidden">
      {/* 背景の装飾カード */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 w-24 h-36 bg-white rounded-lg rotate-[-15deg]" />
        <div className="absolute top-20 right-20 w-24 h-36 bg-white rounded-lg rotate-[20deg]" />
        <div className="absolute bottom-20 left-1/4 w-24 h-36 bg-white rounded-lg rotate-[10deg]" />
        <div className="absolute bottom-10 right-1/3 w-24 h-36 bg-white rounded-lg rotate-[-10deg]" />
      </div>

      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-700 relative z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">ロビー</h1>
          <span className="text-slate-400">{player?.name}</span>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-auto p-4 relative z-10">
        {/* ルーム作成ボタン */}
        <div className="flex justify-end mb-4">
          <Button
            className="text-lg px-6 h-12 bg-blue-600 hover:bg-blue-500 border-0 font-bold shadow-lg transition-all hover:scale-[1.02] text-white"
            onClick={navigateToCreateRoom}
          >
            ルームを作成
          </Button>
        </div>
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg border border-red-700">
            <span>{error}</span>
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-slate-400">読み込み中...</span>
          </div>
        )}

        {/* ルーム一覧 */}
        {!isLoading && rooms.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-slate-400">
              現在、開いているルームはありません
            </span>
          </div>
        )}

        {!isLoading && rooms.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
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
    </div>
  );
}
