import { FEATURE_COUNT, featureIds } from "../../strategy/learnedReading";
import type { ReadingSample } from "./collectSamples";

export interface TrainOptions {
  epochs: number;
  batchSize: number;
  learningRate: number;
  // L2正則化の強さ
  l2: number;
}

const DEFAULT_TRAIN: TrainOptions = {
  epochs: 6,
  batchSize: 512,
  learningRate: 0.05,
  l2: 1e-4,
};

/**
 * 条件付きロジットモデルの重みを、対数尤度の最大化（Adam）で学習する。
 *   P(t) = 土台(t) exp(w・特徴(t)) / Σ_u 土台(u) exp(w・特徴(u))
 */
export function trainReading(
  samples: ReadingSample[],
  initial?: readonly number[],
  options: Partial<TrainOptions> = {},
): number[] {
  const { epochs, batchSize, learningRate, l2 } = {
    ...DEFAULT_TRAIN,
    ...options,
  };
  const w = initial ? [...initial] : new Array<number>(FEATURE_COUNT).fill(0);
  const m = new Array<number>(FEATURE_COUNT).fill(0);
  const v = new Array<number>(FEATURE_COUNT).fill(0);
  const grad = new Array<number>(FEATURE_COUNT).fill(0);
  const order = samples.map((_, i) => i);
  const ids: number[] = [];
  let step = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    shuffle(order, epoch + 1);
    for (let start = 0; start < order.length; start += batchSize) {
      grad.fill(0);
      const end = Math.min(start + batchSize, order.length);
      for (let k = start; k < end; k++) {
        accumulateGradient(samples[order[k]], w, grad, ids);
      }
      const n = end - start;
      step++;
      for (let j = 0; j < FEATURE_COUNT; j++) {
        const g = grad[j] / n + l2 * w[j];
        m[j] = 0.9 * m[j] + 0.1 * g;
        v[j] = 0.999 * v[j] + 0.001 * g * g;
        const mHat = m[j] / (1 - 0.9 ** step);
        const vHat = v[j] / (1 - 0.999 ** step);
        w[j] -= (learningRate * mHat) / (Math.sqrt(vHat) + 1e-8);
      }
    }
  }
  return w;
}

/** 本当の合計点に対する平均対数損失（小さいほど読みが正確） */
export function logLoss(
  samples: ReadingSample[],
  probabilityOfTruth: (sample: ReadingSample) => number,
): number {
  let sum = 0;
  for (const sample of samples) {
    sum -= Math.log(Math.max(probabilityOfTruth(sample), 1e-9));
  }
  return sum / samples.length;
}

/** 学習した重みで、本当の合計点につける確率 */
export function predictTruth(
  sample: ReadingSample,
  w: readonly number[],
): number {
  const ids: number[] = [];
  let sum = 0;
  let truth = 0;
  for (let t = 0; t < sample.base.length; t++) {
    if (sample.base[t] === 0) continue;
    featureIds(t, sample.ctx, ids);
    let score = 0;
    for (const id of ids) score += w[id];
    const value = sample.base[t] * Math.exp(score);
    sum += value;
    if (t === sample.trueIndex) truth = value;
  }
  return sum === 0 ? 0 : truth / sum;
}

function accumulateGradient(
  sample: ReadingSample,
  w: readonly number[],
  grad: number[],
  ids: number[],
): void {
  const { base, ctx, trueIndex } = sample;
  if (base[trueIndex] === 0) return;

  // 期待値の計算のため、各tの重み付き値を先に求める
  const values = new Float64Array(base.length);
  let sum = 0;
  for (let t = 0; t < base.length; t++) {
    if (base[t] === 0) continue;
    featureIds(t, ctx, ids);
    let score = 0;
    for (const id of ids) score += w[id];
    values[t] = base[t] * Math.exp(score);
    sum += values[t];
  }
  if (sum === 0) return;

  // 勾配 = E_P[特徴] - 特徴(本当の合計)
  for (let t = 0; t < base.length; t++) {
    if (values[t] === 0) continue;
    const p = values[t] / sum;
    featureIds(t, ctx, ids);
    for (const id of ids) grad[id] += p;
  }
  featureIds(trueIndex, ctx, ids);
  for (const id of ids) grad[id] -= 1;
}

function shuffle(order: number[], seed: number): void {
  let state = seed * 2654435761;
  for (let i = order.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
}
