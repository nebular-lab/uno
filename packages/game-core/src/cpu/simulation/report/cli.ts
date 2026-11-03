import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectReport } from "./collectReport";
import { renderReport } from "./renderReport";

/**
 * CPUの読みのリプレイと精度をHTMLにまとめる。
 *
 * 使い方: pnpm --filter server cpu-report -- [ゲーム数] [シード]
 * 出力先: apps/server/logs/cpu-report.html
 */
const games = Number(process.argv[2] ?? 300);
const seed = Number(process.argv[3] ?? 1);
const output = resolve("logs/cpu-report.html");

const started = Date.now();
const data = await collectReport(games, seed);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, renderReport(data));

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`${games}ゲームを集計しました（${seconds}秒）: ${output}`);
