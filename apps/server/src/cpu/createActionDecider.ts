import type { ActionDecider } from "./ActionDecider";
import type { GameLog } from "./GameLog";
import { JevActionDecider } from "./JevActionDecider";
import { LlmActionDecider } from "./LlmActionDecider";
import { SearchActionDecider } from "./search/SearchActionDecider";
import { StrategyActionDecider } from "./strategy/StrategyActionDecider";

// 先読みの量は Render の無料プラン（CPU 0.1コア・メモリ512MB）で賄える範囲にする。
// 1000通りの仮定は1コアで約40ms、0.1コアで約0.4秒（思考時間の演出3秒に収まる）。
// CPU同士の対戦では、評価関数だけのCPUに1席あたり約+3点
const SEARCH_SAMPLES = 1000;
// CPUが遅い・混んでいるときの上限（ms）
const SEARCH_BUDGET_MS = 1500;
// 先読み中もサーバーの他の処理を止めないよう、この間隔で処理を譲る
const SEARCH_SLICE_MS = 5;

// 既定は先読み探索のSearch版。
// CPU_DECIDER=strategy で評価関数だけのStrategy版、jev でJev版、llm で従来のLLM（Vercel AI SDK）版に切り替えられる
export function createActionDecider(log: GameLog): ActionDecider {
  switch (process.env.CPU_DECIDER) {
    case "strategy":
      return new StrategyActionDecider(log);
    case "jev":
      return new JevActionDecider();
    case "llm":
      return new LlmActionDecider();
    default:
      return new SearchActionDecider(log, {
        samples: SEARCH_SAMPLES,
        budgetMs: SEARCH_BUDGET_MS,
        sliceMs: SEARCH_SLICE_MS,
        seed: Date.now(),
      });
  }
}
