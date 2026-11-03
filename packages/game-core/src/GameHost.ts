import type { Card, GameState } from "@dobon-uno/shared";
import type { Dispatcher } from "./command";
import type { GameLog } from "./cpu/GameLog";
import type { TurnTimerService } from "./services/TurnTimerService";

/**
 * 演出の待ち時間に使うタイマー（ColyseusのClockTimerと互換）
 */
export interface Clock {
  setTimeout(callback: () => void, delay: number): { clear(): void };
}

/**
 * コマンドが使うゲームの実行環境
 * サーバーのGameRoom・ブラウザ内のGameEngine・シミュレーションがそれぞれ実装する
 */
export interface GameHost {
  state: GameState;
  // 山札（プレイヤーには同期しない）
  deck: Card[];
  dispatcher: Dispatcher;
  clock: Clock;
  turnTimerService: Pick<
    TurnTimerService,
    "startTimer" | "stopTimer" | "stopAllTimers"
  >;
  // 全員に見えている行動の履歴（CPUの推論に使う）
  gameLog: GameLog;
  createDeck(): Card[];
  // 全プレイヤーへのイベント通知（アニメーション用）
  broadcast(type: string, message: unknown): void;
  // PlayerActionUpdater.update() 後に呼び出し、CPUの行動を始める
  checkCPUTurn(): void | Promise<void>;
  // 次のゲーム開始前の状態に戻す
  resetGameState(): void;
}
