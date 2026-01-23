import type { GameState } from "@dobon-uno/shared";
import { TIMING } from "../config/timing";

/**
 * プレイヤーごとに独立したターンタイマーを管理するサービス
 *
 * 責務:
 * - プレイヤー単位でのタイマー開始
 * - プレイヤー単位でのタイマー停止
 * - 全タイマー停止（ゲーム終了時など）
 *
 * タイムアウト時の処理はコールバックとして受け取る（単一責任）
 */
export class TurnTimerService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  /**
   * 特定プレイヤーのタイマーを開始
   * @param playerId 対象プレイヤーのID
   * @param onTimeout タイムアウト時に実行するコールバック
   */
  startTimer(playerId: string, onTimeout: () => void): void {
    this.stopTimer(playerId); // 既存タイマーをクリア

    const player = this.state.players.get(playerId);
    if (!player) return;

    // 残り秒数を設定
    player.timeRemaining = Math.ceil(TIMING.TURN_TIMEOUT / 1000);

    const timer = setTimeout(() => {
      this.timers.delete(playerId);
      player.timeRemaining = 0;
      onTimeout(); // コールバックを実行
    }, TIMING.TURN_TIMEOUT);

    this.timers.set(playerId, timer);
  }

  /**
   * 特定プレイヤーのタイマーを停止
   * @param playerId 対象プレイヤーのID
   */
  stopTimer(playerId: string): void {
    const timer = this.timers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(playerId);
    }

    const player = this.state.players.get(playerId);
    if (player) {
      player.timeRemaining = 0;
    }
  }

  /**
   * 全タイマーを停止（ゲーム終了時など）
   */
  stopAllTimers(): void {
    for (const [playerId] of this.timers) {
      this.stopTimer(playerId);
    }
  }

  /**
   * 特定プレイヤーのタイマーがアクティブかどうか
   * @param playerId 対象プレイヤーのID
   */
  isTimerActive(playerId: string): boolean {
    return this.timers.has(playerId);
  }

  /**
   * アクティブなタイマーの数を取得（テスト用）
   */
  getActiveTimerCount(): number {
    return this.timers.size;
  }
}
