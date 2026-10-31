import { StrategyActionDecider } from "../strategy/StrategyActionDecider";
import { SimpleActionDecider } from "./SimpleActionDecider";
import { type SimulationEntrant, simulateGames } from "./simulateGames";

/**
 * CPU同士を対戦させて強さを比べる。
 *
 * 使い方: pnpm --filter server simulate -- [ゲーム数] [席数]
 * 例: pnpm --filter server simulate -- 1000 4
 */
const games = Number(process.argv[2] ?? 500);
const seats = Number(process.argv[3] ?? 4);

const entrants: SimulationEntrant[] = [
  {
    name: "strategy",
    createDecider: (log) => new StrategyActionDecider(log),
  },
  { name: "simple", createDecider: () => new SimpleActionDecider() },
];

const started = Date.now();
const result = await simulateGames({ entrants, games, seats });
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(
  `${result.games}ゲーム（${seats}人）: 山札切れ ${result.deckOuts} / 進行停止 ${result.stalls} / ${seconds}秒`,
);
console.table(
  result.entrants.map((e) => ({
    name: e.name,
    "平均点/席": Number(e.averageScore.toFixed(2)),
    "95%区間": `±${(1.96 * e.standardError).toFixed(2)}`,
    上がり: e.normalWins,
    ドボン: e.dobonWins,
    ドボン返し: e.dobonReturnWins,
    ドボンされた: e.dobonLosses,
  })),
);
