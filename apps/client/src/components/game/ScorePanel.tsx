import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ClientGameResult, ClientPlayer } from "@/types/connection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScoreChart } from "./ScoreChart";

type ViewMode = "table" | "chart";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "table", label: "表" },
  { value: "chart", label: "グラフ" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  gameHistory: ClientGameResult[];
  players: (ClientPlayer | null)[];
};

export const ScorePanel = ({
  isOpen,
  onClose,
  gameHistory,
  players,
}: Props) => {
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // 参加しているプレイヤーのみ（null除外）
  const activePlayers = players.filter((p): p is ClientPlayer => p !== null);

  // 各プレイヤーの累計スコアを計算
  const getTotalScore = (sessionId: string): number => {
    return gameHistory.reduce((sum, result) => {
      return sum + (result.scoreChanges[sessionId] ?? 0);
    }, 0);
  };

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent
        className="flex w-[90%] max-w-[800px] flex-col overflow-hidden p-8"
        style={{ height: "460px" }}
      >
        {/* スクリーンリーダー用の非表示タイトル */}
        <DialogHeader className="sr-only">
          <DialogTitle>スコアボード</DialogTitle>
        </DialogHeader>

        {gameHistory.length > 0 && (
          <div className="flex justify-end">
            <div className="flex rounded-lg bg-slate-900/60 p-1">
              {VIEW_MODES.map((mode) => (
                <button
                  className={cn(
                    "rounded-md px-4 py-1 text-sm transition-colors",
                    viewMode === mode.value
                      ? "bg-slate-600 text-white"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                  key={mode.value}
                  onClick={() => setViewMode(mode.value)}
                  type="button"
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {gameHistory.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            まだゲーム結果がありません
          </div>
        ) : viewMode === "chart" ? (
          <ScoreChart gameHistory={gameHistory} players={activePlayers} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 固定ヘッダー */}
            <div
              className="grid border-b border-slate-600"
              style={{
                gridTemplateColumns: `80px repeat(${activePlayers.length}, 1fr)`,
              }}
            >
              <div className="px-3 py-3 text-left text-slate-300">ゲーム</div>
              {activePlayers.map((player) => (
                <div
                  className="px-3 py-3 text-center text-slate-300"
                  key={player.sessionId}
                >
                  {player.name}
                </div>
              ))}
            </div>

            {/* スクロール領域 */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
              {gameHistory.map((result) => (
                <div
                  className="grid border-b border-slate-700"
                  key={result.gameNumber}
                  style={{
                    gridTemplateColumns: `80px repeat(${activePlayers.length}, 1fr)`,
                  }}
                >
                  <div className="px-3 py-2 text-slate-400">
                    #{result.gameNumber}
                  </div>
                  {activePlayers.map((player) => {
                    const score = result.scoreChanges[player.sessionId] ?? 0;
                    return (
                      <div
                        className={cn(
                          "px-3 py-2 text-center font-mono",
                          score > 0 && "text-green-400",
                          score < 0 && "text-red-400",
                          score === 0 && "text-slate-400",
                        )}
                        key={player.sessionId}
                      >
                        {score > 0 ? `+${score}` : score}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 固定フッター */}
            <div
              className="grid border-t border-slate-600 font-bold"
              style={{
                gridTemplateColumns: `80px repeat(${activePlayers.length}, 1fr)`,
              }}
            >
              <div className="px-3 py-3 text-white">累計</div>
              {activePlayers.map((player) => {
                const score = getTotalScore(player.sessionId);
                return (
                  <div
                    className={cn(
                      "px-3 py-3 text-center font-mono",
                      score > 0 && "text-green-400",
                      score < 0 && "text-red-400",
                      score === 0 && "text-slate-400",
                    )}
                    key={player.sessionId}
                  >
                    {score > 0 ? `+${score}` : score}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
