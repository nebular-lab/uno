import type { GameState } from "@dobon-uno/shared";
import type { GameLog } from "../../GameLog";
import {
  buildUnseenPool,
  MAX_TRACKED_TOTAL,
} from "../../strategy/handDistribution";
import {
  READING_DETECTION,
  type ReadingContext,
  readingContext,
} from "../../strategy/learnedReading";
import {
  baseTotalDistribution,
  inferBeliefs,
  sumPoints,
} from "../../strategy/opponentModel";
import {
  type DecisionTrace,
  StrategyActionDecider,
  type StrategyOptions,
} from "../../strategy/StrategyActionDecider";
import { simulateGames } from "../simulateGames";

/** 読みの学習データ1件: ある時点のある相手について、土台の分布・手がかり・本当の合計 */
export interface ReadingSample {
  base: Float64Array;
  ctx: ReadingContext;
  // 本当の合計点（上限超えは MAX_TRACKED_TOTAL + 1）
  trueIndex: number;
  // 判断したCPUがつけていた、本当の合計点の確率（比較用）
  usedP: number;
}

/**
 * 指定した設定のCPU4人を対戦させ、手番の判断のたびに相手ごとの学習データを集める。
 */
export async function collectReadingSamples(
  options: StrategyOptions,
  games: number,
  seed: number,
  keepRate = 1,
): Promise<ReadingSample[]> {
  const samples: ReadingSample[] = [];
  let random = seed >>> 0;
  const next = () => {
    random = (random * 1664525 + 1013904223) >>> 0;
    return random / 2 ** 32;
  };

  const onTrace = (trace: DecisionTrace, state: GameState, log: GameLog) => {
    if (trace.kind !== "action" || trace.candidates.length === 0) return;
    const me = state.players.get(trace.playerId);
    if (!me) return;
    const pool = buildUnseenPool(state, me);
    const beliefs = inferBeliefs(
      log.getEvents(),
      state.players.keys(),
      READING_DETECTION,
    );
    for (const opponent of trace.opponents) {
      if (keepRate < 1 && next() > keepRate) continue;
      const player = state.players.get(opponent.sessionId);
      if (!player) continue;
      const belief = beliefs.get(opponent.sessionId);
      const trueIndex = Math.min(
        sumPoints(player.myHand),
        MAX_TRACKED_TOTAL + 1,
      );
      samples.push({
        base: Float64Array.from(
          baseTotalDistribution(
            belief,
            player.handCount,
            pool,
            READING_DETECTION,
          ),
        ),
        ctx: readingContext(belief, player.handCount),
        trueIndex,
        usedP: opponent.dist[trueIndex],
      });
    }
  };

  await simulateGames({
    games,
    seats: 4,
    seed,
    entrants: [
      {
        name: "collector",
        createDecider: (log) =>
          new StrategyActionDecider(log, {
            ...options,
            onTrace: (trace, state) => onTrace(trace, state, log),
          }),
      },
    ],
  });
  return samples;
}
