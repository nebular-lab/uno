/**
 * ゲームのタイミング設定
 * テスト環境では高速化するため、SPEED_MULTIPLIERで調整
 */
const isTest = process.env.NODE_ENV === "test";
const SPEED_MULTIPLIER = isTest ? 0.01 : 1;

export const TIMING = {
  /** カード配布間隔 (ms) */
  DEAL_INTERVAL: Math.max(1, 300 * SPEED_MULTIPLIER),
  /** 配布完了後の待機 (ms) */
  DEAL_COMPLETE_DELAY: Math.max(1, 500 * SPEED_MULTIPLIER),
  /** カウントダウン間隔 (ms) */
  COUNTDOWN_INTERVAL: Math.max(1, 1000 * SPEED_MULTIPLIER),
  /** 場札公開後の待機 (ms) */
  REVEAL_DELAY: Math.max(1, 1000 * SPEED_MULTIPLIER),
  /**
   * ターンタイムアウト (ms) - 本番: 10秒、テスト: 60秒
   * テスト環境では長めに設定し、タイムアウトによるテスト失敗を防ぐ
   * タイマー機能のテストでは TurnTimerService.setTurnTimeout() で短い値を設定する
   */
  TURN_TIMEOUT: isTest ? 60000 : 10000,
};
