import type { RoomListingData } from "@dobon-uno/shared";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoomCardProps {
  room: RoomListingData;
  onJoin?: () => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const ownerName = room.metadata?.ownerName ?? "不明";

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex flex-col gap-1">
        <span className="font-medium">{ownerName}</span>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>
            {room.clients} / {room.maxClients}
          </span>
        </div>
      </div>
      <Button onClick={onJoin} size="sm" variant="outline">
        参加
      </Button>
    </div>
  );
}
