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
      </div>
      <Button
        className="w-full h-20 bg-blue-600 hover:bg-blue-500 border-0 font-bold text-white transition-all text-lg"
        onClick={onJoin}
      >
        参加
      </Button>
    </div>
  );
}
