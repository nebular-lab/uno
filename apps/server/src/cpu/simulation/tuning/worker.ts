import { headToHead } from "./headToHead";

/**
 * 調整の子プロセス。引数のJSONで渡された2つの設定を対戦させ、結果をJSONで標準出力に書く。
 */
const job = JSON.parse(process.argv[2]);
const result = await headToHead(
  job.challenger,
  job.champion,
  job.games,
  job.seed,
);
process.stdout.write(`${JSON.stringify(result)}\n`);
