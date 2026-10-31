import { describe, expect, it } from "vitest";
import { MAX_TRACKED_TOTAL } from "../../strategy/handDistribution";
import {
  FEATURE_COUNT,
  learnedDistribution,
  type ReadingContext,
} from "../../strategy/learnedReading";
import type { ReadingSample } from "./collectSamples";
import { logLoss, predictTruth, trainReading } from "./trainReading";

// 合計は5点か9点が半々の土台
function base(): Float64Array {
  const dist = new Float64Array(MAX_TRACKED_TOTAL + 2);
  dist[5] = 0.5;
  dist[9] = 0.5;
  return dist;
}

function context(excluded: number[]): ReadingContext {
  return {
    hand: 0,
    excluded: new Set(excluded),
    baitTotal: -1,
    baitSource: -1,
    lastPoints: -1,
    lastValue: -1,
    drawn: false,
  };
}

describe("trainReading", () => {
  it("ドボンしなかった点数が本当の合計にならないことを学習する", () => {
    // 9点にドボンしなかった人の合計は、いつも5点
    const samples: ReadingSample[] = Array.from({ length: 400 }, () => ({
      base: base(),
      ctx: context([9]),
      trueIndex: 5,
      usedP: 0.5,
    }));

    const weights = trainReading(samples, undefined, { epochs: 30 });

    expect(predictTruth(samples[0], weights)).toBeGreaterThan(0.9);
    expect(logLoss(samples, (s) => predictTruth(s, weights))).toBeLessThan(
      logLoss(samples, (s) => s.base[s.trueIndex]),
    );
  });

  it("重みが0なら土台の分布のまま", () => {
    const dist = learnedDistribution(
      Array.from(base()),
      context([9]),
      new Array<number>(FEATURE_COUNT).fill(0),
    );

    expect(dist[5]).toBeCloseTo(0.5);
    expect(dist[9]).toBeCloseTo(0.5);
  });
});
