import { GameResult, type GameState } from "@dobon-uno/shared";

/** 上がり表示時間（ミリ秒） */
export const FINISH_DISPLAY_DURATION = 3000;
/** スコアパネル表示時間（ミリ秒） */
export const SCORE_DISPLAY_DURATION = 5000;
/** 結果表示合計時間（ミリ秒） */
export const RESULT_DISPLAY_DURATION =
  FINISH_DISPLAY_DURATION + SCORE_DISPLAY_DURATION;

/**
 * 全プレイヤーの手札合計点数を計算
 * @param state ゲーム状態
 * @param excludePlayerIds 除外するプレイヤーIDの配列
 * @returns 合計点数
 */
export function calculateTotalHandPoints(
  state: GameState,
  excludePlayerIds?: string[],
): number {
  let total = 0;

  for (const [playerId, player] of state.players.entries()) {
    if (excludePlayerIds?.includes(playerId)) {
      continue;
    }

    for (const card of player.myHand) {
      total += card.points;
    }
  }

  return total;
}

/**
 * GameResultを作成
 * @param state ゲーム状態
 * @param winnerId 勝者のsessionId
 * @param finishType 終了タイプ
 * @param scoreChanges 各プレイヤーのスコア変動
 * @returns 作成されたGameResult
 */
export function createGameResult(
  state: GameState,
  winnerId: string,
  finishType: "normal" | "dobon" | "dobonReturn",
  scoreChanges: Map<string, number>,
): GameResult {
  const result = new GameResult();
  result.gameNumber = state.gameHistory.length + 1;
  result.winnerId = winnerId;
  result.finishType = finishType;
  result.timestamp = Date.now();

  for (const [playerId, change] of scoreChanges.entries()) {
    result.scoreChanges.set(playerId, change);
  }

  return result;
}
