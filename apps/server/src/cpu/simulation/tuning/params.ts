import { LEARNED_READING_WEIGHTS } from "../../strategy/learnedReadingWeights";
import {
  DEFAULT_INFERENCE,
  type InferenceParams,
} from "../../strategy/opponentModel";
import {
  DEFAULT_WEIGHTS,
  type StrategyOptions,
  type StrategyWeights,
} from "../../strategy/StrategyActionDecider";

/** 自動調整する定数（評価関数の重み＋推論の定数） */
export interface TunableParams {
  weights: StrategyWeights;
  inference: InferenceParams;
  // 学習した読み（learnedReadingWeights.ts）を使うか。使うと推論の定数は効かない
  learnedReading?: boolean;
}

export const DEFAULT_TUNABLE: TunableParams = {
  weights: DEFAULT_WEIGHTS,
  inference: DEFAULT_INFERENCE,
};

export function toStrategyOptions(params: TunableParams): StrategyOptions {
  return {
    weights: params.weights,
    inference: params.inference,
    reading: params.learnedReading ? LEARNED_READING_WEIGHTS : undefined,
  };
}

export interface Move {
  label: string;
  apply: (params: TunableParams) => TunableParams;
}

const scaleWeight =
  (key: keyof StrategyWeights, factor: number): Move["apply"] =>
  (p) => ({ ...p, weights: { ...p.weights, [key]: p.weights[key] * factor } });

const shiftWeight =
  (key: keyof StrategyWeights, delta: number): Move["apply"] =>
  (p) => ({
    ...p,
    weights: { ...p.weights, [key]: Math.max(0, p.weights[key] + delta) },
  });

/**
 * 今の値から試す変更の一覧。
 */
export function listMoves(params: TunableParams): Move[] {
  const moves: Move[] = [];
  const scaled: (keyof StrategyWeights)[] = [
    "holdCost",
    "cardCost",
    "dobonChance",
    "drawOption",
    "tempo",
  ];
  for (const key of scaled) {
    moves.push({ label: `${key} ×0.6`, apply: scaleWeight(key, 0.6) });
    moves.push({ label: `${key} ×1.6`, apply: scaleWeight(key, 1.6) });
  }
  moves.push({
    label: "maxDobonReturnRisk -0.1",
    apply: shiftWeight("maxDobonReturnRisk", -0.1),
  });
  moves.push({
    label: "maxDobonReturnRisk +0.1",
    apply: shiftWeight("maxDobonReturnRisk", 0.1),
  });
  moves.push({
    label: "trapColorFactor ×0.7",
    apply: scaleWeight("trapColorFactor", 0.7),
  });
  moves.push({
    label: "trapColorFactor ×1.4",
    apply: scaleWeight("trapColorFactor", 1.4),
  });

  const inference = (
    label: string,
    change: (i: InferenceParams) => InferenceParams,
  ): Move => ({
    label,
    apply: (p) => ({ ...p, inference: change(p.inference) }),
  });
  // 学習した読みを使うときは、推論の定数は効かないので動かさない
  if (params.learnedReading) return moves;
  moves.push(
    inference("excludedTotalFactor ×0.3", (i) => ({
      ...i,
      excludedTotalFactor: i.excludedTotalFactor * 0.3,
    })),
    inference("excludedTotalFactor ×3", (i) => ({
      ...i,
      excludedTotalFactor: Math.min(1, i.excludedTotalFactor * 3),
    })),
    inference("lackWeight ×0.5", (i) => ({
      ...i,
      lackWeight: i.lackWeight * 0.5,
    })),
    inference("lackWeight ×2", (i) => ({
      ...i,
      lackWeight: Math.min(1, i.lackWeight * 2),
    })),
    inference("baitWeights ×0", (i) => ({
      ...i,
      baitWeights: scaleRecord(i.baitWeights, 0),
    })),
    inference("baitWeights ×0.4", (i) => ({
      ...i,
      baitWeights: scaleRecord(i.baitWeights, 0.4),
    })),
  );
  return moves;
}

function scaleRecord(
  record: Record<string, number>,
  factor: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, v * factor]),
  );
}
