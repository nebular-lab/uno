import { cn } from "@/lib/utils";
import type { ClientGameResult, ClientPlayer } from "@/types/connection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

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
  // 参加しているプレイヤーのみ（null除外）
  const activePlayers = players.filter((p): p is ClientPlayer => p !== null);

  // 各プレイヤーの累計スコアを計算
  const getTotalScore = (sessionId: string): number => {
    return gameHistory.reduce((sum, result) => {
      return sum + (result.scoreChanges[sessionId] ?? 0);
    }, 0);
  };

  // スコアの表示（プラスは緑、マイナスは赤）
  const ScoreCell = ({ score }: { score: number }) => (
    <td
      className={cn(
        "px-3 py-2 text-center font-mono",
        score > 0 && "text-green-400",
        score < 0 && "text-red-400",
        score === 0 && "text-slate-400",
      )}
    >
      {score > 0 ? `+${score}` : score}
    </td>
  );

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="max-h-[80vh] w-[90%] max-w-[800px] overflow-hidden p-0">
        {/* ヘッダー */}
        <DialogHeader className="border-b border-slate-600 px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-white">
            スコアボード
          </DialogTitle>
        </DialogHeader>

        {/* テーブル */}
        <div className="overflow-auto p-6">
          {gameHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              まだゲーム結果がありません
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="px-3 py-2 text-left text-slate-300">ゲーム</th>
                  {activePlayers.map((player) => (
                    <th
                      className="px-3 py-2 text-center text-slate-300"
                      key={player.sessionId}
                    >
                      {player.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gameHistory.map((result) => (
                  <tr
                    className="border-b border-slate-700"
                    key={result.gameNumber}
                  >
                    <td className="px-3 py-2 text-slate-400">
                      #{result.gameNumber}
                    </td>
                    {activePlayers.map((player) => (
                      <ScoreCell
                        key={player.sessionId}
                        score={result.scoreChanges[player.sessionId] ?? 0}
                      />
                    ))}
                  </tr>
                ))}
                {/* 累計行 */}
                <tr className="bg-slate-700/50 font-bold">
                  <td className="px-3 py-2 text-white">累計</td>
                  {activePlayers.map((player) => (
                    <ScoreCell
                      key={player.sessionId}
                      score={getTotalScore(player.sessionId)}
                    />
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
