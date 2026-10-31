import type { ActionDecider } from "./ActionDecider";
import { JevActionDecider } from "./JevActionDecider";
import { LlmActionDecider } from "./LlmActionDecider";

// CPU_DECIDER=llm で従来のLLM（Vercel AI SDK）版に切り替えられる。既定はJev版
export function createActionDecider(): ActionDecider {
  if (process.env.CPU_DECIDER === "llm") {
    return new LlmActionDecider();
  }
  return new JevActionDecider();
}
