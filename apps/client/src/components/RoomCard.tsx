import type { RoomAvailable } from "@colyseus/sdk";
import type { RoomMetadata } from "@dobon-uno/shared";
import { Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ルームに参加できるプレイヤーの最大人数
const MAX_PLAYERS = 6;

interface RoomCardProps {
  room: RoomAvailable<RoomMetadata>;
  onJoin?: () => void;
  onSpectate?: () => void;
}

export function RoomCard({ room, onJoin, onSpectate }: RoomCardProps) {
  const ownerName = room.metadata?.ownerName ?? "不明";
  const isPlaying = room.metadata?.status === "playing";
  const playerNames = room.metadata?.playerNames ?? [];
  const spectatorCount = room.metadata?.spectatorCount ?? 0;
  const isFull = playerNames.length >= MAX_PLAYERS;

  return (
    <div className="flex flex-col p-4 rounded-xl bg-slate-800/50 border border-slate-700 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-white text-lg truncate">
          {ownerName}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
            isPlaying
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-green-500/20 text-green-400",
          )}
        >
          {isPlaying ? "進行中" : "開始前"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-400 mb-2">
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {playerNames.length} / {MAX_PLAYERS}
        </span>
        {spectatorCount > 0 && (
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {spectatorCount}
          </span>
        )}
      </div>
      {/* 参加プレイヤー名 */}
      <ul className="flex flex-wrap gap-1 mb-4 min-h-14 content-start">
        {playerNames.map((name, index) => (
          <li
            className="max-w-full truncate rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200"
            // 同名プレイヤーがいてもキーが重複しないよう席順を含める
            key={`${index}-${name}`}
          >
            {name}
          </li>
        ))}
      </ul>
      {isPlaying ? (
        <Button
          className="mt-auto w-full h-20 bg-amber-600 hover:bg-amber-500 border-0 font-bold text-white transition-all text-lg"
          onClick={onSpectate}
        >
          観戦
        </Button>
      ) : (
        <Button
          className="mt-auto w-full h-20 bg-blue-600 hover:bg-blue-500 border-0 font-bold text-white transition-all text-lg disabled:opacity-50 disabled:hover:bg-blue-600"
          disabled={isFull}
          onClick={onJoin}
        >
          {isFull ? "満員" : "参加"}
        </Button>
      )}
    </div>
  );
}
