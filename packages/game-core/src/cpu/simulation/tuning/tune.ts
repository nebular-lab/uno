import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { StrategyOptions } from "../../strategy/StrategyActionDecider";
import type { HeadToHeadResult } from "./headToHead";
import {
  DEFAULT_TUNABLE,
  listMoves,
  type TunableParams,
  toStrategyOptions,
} from "./params";

/**
 * 定数をCPU同士の対戦で自動調整する（座標探索）。
 * 今の最良の設定から1つずつ値を動かした設定を並列に対戦させ、
 * 有意に勝った（平均 - 1.96×標準誤差 > 0）変更のうち一番良いものを採用する。
 *
 * 使い方: pnpm --filter server tune -- [1回あたりのゲーム数] [最大ラウンド数] [初期値のJSON]
 * 同時に動かす対戦の数は TUNE_PARALLEL（既定3）。PCに負荷をかけすぎないよう、優先度を下げて動かす。
 */
const execFileAsync = promisify(execFile);
const games = Number(process.argv[2] ?? 8000);
const rounds = Number(process.argv[3] ?? 4);
let best: TunableParams = process.argv[4]
  ? JSON.parse(process.argv[4])
  : DEFAULT_TUNABLE;

const workerPath = fileURLToPath(new URL("./worker.ts", import.meta.url));
const parallel = Math.max(1, Number(process.env.TUNE_PARALLEL ?? 3));

async function runJob(
  challenger: StrategyOptions,
  champion: StrategyOptions,
  seed: number,
): Promise<HeadToHeadResult> {
  const job = JSON.stringify({ challenger, champion, games, seed });
  const { stdout } = await execFileAsync(
    "nice",
    ["-n", "15", "npx", "tsx", workerPath, job],
    {
      maxBuffer: 1 << 20,
    },
  );
  const line = stdout.trim().split("\n").pop() ?? "{}";
  return JSON.parse(line);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

for (let round = 1; round <= rounds; round++) {
  const seed = round * 100_003;
  const moves = listMoves(best);
  console.log(`\n== ラウンド ${round}（${moves.length}通り × ${games}ゲーム）`);
  const results = await mapLimit(moves, parallel, async (move) => {
    const result = await runJob(
      toStrategyOptions(move.apply(best)),
      toStrategyOptions(best),
      seed,
    );
    const margin = 1.96 * result.standardError;
    console.log(
      `${move.label.padEnd(28)} ${result.score.toFixed(2).padStart(7)} ±${margin.toFixed(2)}`,
    );
    return { move, result, lower: result.score - margin };
  });

  const winner = results
    .filter((r) => r.lower > 0)
    .sort((a, b) => b.result.score - a.result.score)[0];
  if (!winner) {
    console.log("有意に良くなる変更はありませんでした");
    break;
  }
  best = winner.move.apply(best);
  console.log(`採用: ${winner.move.label}`);
  console.log(JSON.stringify(best));
}

console.log("\n最終的な設定:");
console.log(JSON.stringify(best, null, 2));
