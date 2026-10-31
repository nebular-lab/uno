import type { ActionDecider } from "./ActionDecider";
import type { GameLog } from "./GameLog";
import { JevActionDecider } from "./JevActionDecider";
import { LlmActionDecider } from "./LlmActionDecider";
import { StrategyActionDecider } from "./strategy/StrategyActionDecider";

// 既定は確率計算と評価関数で決めるStrategy版。
// CPU_DECIDER=jev でJev版、CPU_DECIDER=llm で従来のLLM（Vercel AI SDK）版に切り替えられる
export function createActionDecider(log: GameLog): ActionDecider {
  if (process.env.CPU_DECIDER === "jev") {
    return new JevActionDecider();
  }
  if (process.env.CPU_DECIDER === "llm") {
    return new LlmActionDecider();
  }
  return new StrategyActionDecider(log);
}
