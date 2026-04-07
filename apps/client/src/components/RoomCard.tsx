import type { RoomMetadata } from "@dobon-uno/shared";
import type { RoomAvailable } from "colyseus.js";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoomCardProps {
  room: RoomAvailable<RoomMetadata>;
  onJoin?: () => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const ownerName = room.metadata?.ownerName ?? "不明";
  const phase = room.metadata?.phase ?? "waiting";
  const isInGame = phase !== "waiting";

  return (
    <div className="flex flex-col p-4 rounded-xl bg-slate-800/50 border border-slate-700 shadow-lg backdrop-blur-sm">
      <span className="font-bold text-white text-lg mb-2 truncate">
        {ownerName}
      </span>
      <div className="flex items-center gap-1 text-sm text-slate-400 mb-4">
        <Users className="w-4 h-4" />
        <span>
          {room.clients} / {room.maxClients}
        </span>
        {isInGame && (
          <span className="ml-auto text-xs text-yellow-400 font-medium">
            ゲーム中
          </span>
        )}
      </div>
      <Button
        className="w-full h-20 bg-blue-600 hover:bg-blue-500 border-0 font-bold text-white transition-all text-lg disabled:opacity-50 disabled:hover:bg-blue-600"
        disabled={isInGame}
        onClick={onJoin}
      >
        {isInGame ? "ゲーム中" : "参加"}
      </Button>
    </div>
  );
}
