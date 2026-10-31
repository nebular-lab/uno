import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LEARNED_READING_WEIGHTS } from "../../strategy/learnedReadingWeights";
import type { StrategyOptions } from "../../strategy/StrategyActionDecider";
import { headToHead } from "../tuning/headToHead";
import { DEFAULT_TUNABLE, toStrategyOptions } from "../tuning/params";
import { collectInParallel } from "./parallelCollect";
import { logLoss, predictTruth, trainReading } from "./trainReading";

/**
 * 相手の手札合計の読みを、CPU同士の対戦データから学習する。
 * 「今の読みで対戦 → データを集めて学習 → 新しい読みで対戦 …」を繰り返し、
 * 最後に学習した読みのCPUと手で決めた推論のCPUを対戦させて比べる。
 *
 * 使い方: pnpm --filter server train-reading -- [1回あたりのゲーム数] [繰り返し回数] [評価のゲーム数]
 * 結果は src/cpu/strategy/learnedReadingWeights.ts に書き出す。
 * データ集めは READING_PARALLEL（既定4）個の子プロセスに分け、優先度を下げて動かす。
 */
const games = Number(process.argv[2] ?? 3000);
const iterations = Number(process.argv[3] ?? 3);
const evalGames = Number(process.argv[4] ?? 8000);
const parallel = Math.max(1, Number(process.env.READING_PARALLEL ?? 4));
const handTuned: StrategyOptions = toStrategyOptions(DEFAULT_TUNABLE);
const output = fileURLToPath(
  new URL("../../strategy/learnedReadingWeights.ts", import.meta.url),
);

let weights: readonly number[] | undefined = LEARNED_READING_WEIGHTS;

for (let iteration = 1; iteration <= iterations; iteration++) {
  const started = Date.now();
  const samples = await collectInParallel(
    { ...handTuned, reading: weights },
    games,
    iteration * 7919,
    0.5,
    parallel,
  );
  const split = Math.floor(samples.length * 0.9);
  const train = samples.slice(0, split);
  const holdout = samples.slice(split);

  weights = trainReading(train, weights);

  const learned = weights;
  console.log(
    `[${iteration}] ${samples.length}件（${((Date.now() - started) / 1000).toFixed(0)}秒） 対数損失: ` +
      `土台のみ ${logLoss(holdout, (s) => s.base[s.trueIndex]).toFixed(4)} / ` +
      `対戦で使った読み ${logLoss(holdout, (s) => s.usedP).toFixed(4)} / ` +
      `学習後 ${logLoss(holdout, (s) => predictTruth(s, learned)).toFixed(4)}`,
  );
  writeFileSync(
    output,
    `// pnpm --filter server train-reading で生成する（手で編集しない）\nexport const LEARNED_READING_WEIGHTS: readonly number[] | undefined = ${JSON.stringify(weights.map((w) => Number(w.toFixed(4))))};\n`,
  );
}

if (evalGames > 0 && weights) {
  const result = await headToHead(
    { ...handTuned, reading: weights },
    handTuned,
    evalGames,
    987_654,
  );
  console.log(
    `学習した読み vs 手で決めた推論（${evalGames}ゲーム）: ${result.score.toFixed(2)} ±${(1.96 * result.standardError).toFixed(2)}`,
  );
}
