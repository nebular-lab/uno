import { cn } from "@/lib/utils";
import type { ClientGameResult, ClientPlayer } from "@/types/connection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

// 「ゲーム」列の幅（ゲーム番号・レート倍率・流局を並べる）
const GAME_COLUMN_WIDTH = "130px";

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
  // 成績表の列: 参加中のプレイヤー（席順）のあとに、成績が残っている退席したプレイヤーを並べる
  const columns: { sessionId: string; name: string; hasLeft: boolean }[] =
    players
      .filter((p): p is ClientPlayer => p !== null)
      .map((p) => ({ sessionId: p.sessionId, name: p.name, hasLeft: false }));
  for (const result of gameHistory) {
    for (const sessionId of Object.keys(result.scoreChanges)) {
      if (columns.some((c) => c.sessionId === sessionId)) continue;
      // 名前は最後に参加したゲームのものを使う
      const lastResult = [...gameHistory]
        .reverse()
        .find((r) => r.playerNames[sessionId] !== undefined);
      columns.push({
        sessionId,
        name: lastResult?.playerNames[sessionId] ?? "",
        hasLeft: true,
      });
    }
  }

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

        {gameHistory.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            まだゲーム結果がありません
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 固定ヘッダー */}
            <div
              className="grid border-b border-slate-600"
              style={{
                gridTemplateColumns: `${GAME_COLUMN_WIDTH} repeat(${columns.length}, 1fr)`,
              }}
            >
              <div className="px-3 py-3 text-left text-slate-300">ゲーム</div>
              {columns.map((column) => (
                <div
                  className={cn(
                    "px-3 py-3 text-center",
                    column.hasLeft ? "text-slate-500" : "text-slate-300",
                  )}
                  key={column.sessionId}
                >
                  {column.name}
                  {column.hasLeft && (
                    <span className="ml-1 text-xs">（退席）</span>
                  )}
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
                    gridTemplateColumns: `${GAME_COLUMN_WIDTH} repeat(${columns.length}, 1fr)`,
                  }}
                >
                  <div className="flex items-center gap-1.5 px-3 py-2 text-slate-400">
                    <span>#{result.gameNumber}</span>
                    {result.rateMultiplier > 1 && (
                      <span className="font-mono text-xs font-bold text-amber-400">
                        x{result.rateMultiplier}
                      </span>
                    )}
                    {result.finishType === "deckOut" && (
                      <span className="text-xs text-slate-500">流局</span>
                    )}
                  </div>
                  {columns.map((column) => {
                    const score = result.scoreChanges[column.sessionId];
                    // そのゲームに参加していなかった（退席後など）場合は「-」
                    if (score === undefined) {
                      return (
                        <div
                          className="px-3 py-2 text-center font-mono text-slate-600"
                          key={column.sessionId}
                        >
                          -
                        </div>
                      );
                    }
                    return (
                      <div
                        className={cn(
                          "px-3 py-2 text-center font-mono",
                          score > 0 && "text-green-400",
                          score < 0 && "text-red-400",
                          score === 0 && "text-slate-400",
                        )}
                        key={column.sessionId}
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
                gridTemplateColumns: `${GAME_COLUMN_WIDTH} repeat(${columns.length}, 1fr)`,
              }}
            >
              <div className="px-3 py-3 text-white">累計</div>
              {columns.map((column) => {
                const score = getTotalScore(column.sessionId);
                return (
                  <div
                    className={cn(
                      "px-3 py-3 text-center font-mono",
                      score > 0 && "text-green-400",
                      score < 0 && "text-red-400",
                      score === 0 && "text-slate-400",
                    )}
                    key={column.sessionId}
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
