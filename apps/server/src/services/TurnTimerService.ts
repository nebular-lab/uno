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
  private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();
  private state: GameState;
  private turnTimeout: number;

  constructor(state: GameState) {
    this.state = state;
    this.turnTimeout = TIMING.TURN_TIMEOUT;
  }

  /**
   * ターンタイムアウト時間を設定する（テスト用）
   * @param timeout タイムアウト時間（ミリ秒）
   */
  setTurnTimeout(timeout: number): void {
    this.turnTimeout = timeout;
  }

  /**
   * 現在のターンタイムアウト時間を取得する
   */
  getTurnTimeout(): number {
    return this.turnTimeout;
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
    player.timeRemaining = Math.ceil(this.turnTimeout / 1000);

    // 1秒ごとにカウントダウン
    const interval = setInterval(() => {
      if (player.timeRemaining > 0) {
        player.timeRemaining--;
      }
    }, 1000);
    this.intervalTimers.set(playerId, interval);

    // タイムアウト時の処理
    const timeout = setTimeout(() => {
      this.clearTimers(playerId);
      player.timeRemaining = 0;
      onTimeout(); // コールバックを実行
    }, this.turnTimeout);
    this.timeoutTimers.set(playerId, timeout);
  }

  /**
   * 特定プレイヤーのタイマーを停止
   * @param playerId 対象プレイヤーのID
   */
  stopTimer(playerId: string): void {
    this.clearTimers(playerId);

    const player = this.state.players.get(playerId);
    if (player) {
      player.timeRemaining = 0;
    }
  }

  /**
   * タイマーをクリアする（内部用）
   */
  private clearTimers(playerId: string): void {
    const timeout = this.timeoutTimers.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutTimers.delete(playerId);
    }

    const interval = this.intervalTimers.get(playerId);
    if (interval) {
      clearInterval(interval);
      this.intervalTimers.delete(playerId);
    }
  }

  /**
   * 全タイマーを停止（ゲーム終了時など）
   */
  stopAllTimers(): void {
    for (const [playerId] of this.timeoutTimers) {
      this.stopTimer(playerId);
    }
  }

  /**
   * 特定プレイヤーのタイマーがアクティブかどうか
   * @param playerId 対象プレイヤーのID
   */
  isTimerActive(playerId: string): boolean {
    return this.timeoutTimers.has(playerId);
  }

  /**
   * アクティブなタイマーの数を取得（テスト用）
   */
  getActiveTimerCount(): number {
    return this.timeoutTimers.size;
  }
}
