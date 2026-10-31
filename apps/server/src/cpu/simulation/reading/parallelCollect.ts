import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MAX_TRACKED_TOTAL } from "../../strategy/handDistribution";
import type { StrategyOptions } from "../../strategy/StrategyActionDecider";
import { collectReadingSamples, type ReadingSample } from "./collectSamples";

const execFileAsync = promisify(execFile);
const BASE_LENGTH = MAX_TRACKED_TOTAL + 2;

interface ShardJob {
  options: StrategyOptions;
  games: number;
  seed: number;
  keepRate: number;
  out: string;
}

interface SampleMeta {
  ctx: Omit<ReadingSample["ctx"], "excluded"> & { excluded: number[] };
  trueIndex: number;
  usedP: number;
}

/**
 * 学習データ集めを複数の子プロセスに分けて行う（優先度を下げて動かす）。
 */
export async function collectInParallel(
  options: StrategyOptions,
  games: number,
  seed: number,
  keepRate: number,
  parallel: number,
): Promise<ReadingSample[]> {
  const dir = mkdtempSync(join(tmpdir(), "dobon-reading-"));
  const worker = fileURLToPath(import.meta.url);
  try {
    const shards = Array.from({ length: parallel }, (_, i) => ({
      options,
      games: Math.ceil(games / parallel),
      seed: seed + i * 1_000_003,
      keepRate,
      out: join(dir, `shard-${i}`),
    }));
    await Promise.all(
      shards.map((job) =>
        execFileAsync(
          "nice",
          ["-n", "15", "npx", "tsx", worker, JSON.stringify(job)],
          { maxBuffer: 1 << 20 },
        ),
      ),
    );
    return shards.flatMap((job) => readShard(job.out));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeShard(out: string, samples: ReadingSample[]): void {
  const base = new Float64Array(samples.length * BASE_LENGTH);
  samples.forEach((s, i) => {
    base.set(s.base, i * BASE_LENGTH);
  });
  writeFileSync(`${out}.bin`, Buffer.from(base.buffer));
  const meta: SampleMeta[] = samples.map((s) => ({
    ctx: { ...s.ctx, excluded: [...s.ctx.excluded] },
    trueIndex: s.trueIndex,
    usedP: s.usedP,
  }));
  writeFileSync(`${out}.json`, JSON.stringify(meta));
}

function readShard(out: string): ReadingSample[] {
  const buffer = readFileSync(`${out}.bin`);
  const base = new Float64Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 8,
  );
  const meta: SampleMeta[] = JSON.parse(readFileSync(`${out}.json`, "utf8"));
  return meta.map((m, i) => ({
    base: base.slice(i * BASE_LENGTH, (i + 1) * BASE_LENGTH),
    ctx: { ...m.ctx, excluded: new Set(m.ctx.excluded) },
    trueIndex: m.trueIndex,
    usedP: m.usedP,
  }));
}

// 子プロセスとして起動されたとき: 担当分のデータを集めてファイルに書く
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const job: ShardJob = JSON.parse(process.argv[2]);
  const samples = await collectReadingSamples(
    job.options,
    job.games,
    job.seed,
    job.keepRate,
  );
  writeShard(job.out, samples);
}
