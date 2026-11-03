import {
  StrategyActionDecider,
  type StrategyOptions,
} from "../../strategy/StrategyActionDecider";
import { simulateGames } from "../simulateGames";

export interface HeadToHeadResult {
  // challenger の1席あたりの平均点（ゼロサムなので、相手はこの符号違い）
  score: number;
  standardError: number;
}

/**
 * 2つの設定のCPUを2人ずつ座らせて対戦させる。
 */
export async function headToHead(
  challenger: StrategyOptions,
  champion: StrategyOptions,
  games: number,
  seed: number,
): Promise<HeadToHeadResult> {
  const result = await simulateGames({
    games,
    seats: 4,
    seed,
    duplicate: true,
    entrants: [
      {
        name: "challenger",
        createDecider: (log) => new StrategyActionDecider(log, challenger),
      },
      {
        name: "champion",
        createDecider: (log) => new StrategyActionDecider(log, champion),
      },
    ],
  });
  const [stats] = result.entrants;
  return { score: stats.averageScore, standardError: stats.standardError };
}
