import { Encoder } from "@colyseus/schema";
import { type Clock, GameEngine } from "@dobon-uno/game-core";
import type { GameRoomLike } from "@dobon-uno/game-ui";
import { type GameState, Player } from "@dobon-uno/shared";

// 自分のsessionId
export const LOCAL_SESSION_ID = "you";

// 自分の表示名
const PLAYER_NAME = "あなた";

// CPUを座らせる席（自分の席1から時計回り。正面の席4は空席にする）
const CPU_SEATS = [2, 3, 5, 6];

// CPUの表示名
const CPU_NAME = "CPU";

// 状態の変化を画面に知らせる間隔（Colyseusのパッチ送信と同じ50ms）
const PATCH_INTERVAL = 50;

// 正常に退席したときのコード（Colyseusと同じ）
const LEAVE_CODE_CONSENTED = 1000;

type StateCallback = (state: GameState) => void;

/**
 * ブラウザの中だけで動くゲームルーム
 * サーバーのGameRoomと同じGameEngineを動かし、画面にはColyseusのRoomと同じ形で見せる
 */
export class LocalGameRoom implements GameRoomLike {
  readonly roomId = "local";
  readonly sessionId = LOCAL_SESSION_ID;

  private readonly engine: GameEngine;
  // 状態の変化を検知するためのエンコーダー（送信はしない）
  private readonly encoder: Encoder<GameState>;
  private readonly patchTimer: ReturnType<typeof setInterval>;
  private readonly timeouts = new Set<ReturnType<typeof setTimeout>>();

  private readonly stateCallbacks = new Set<StateCallback>();
  private readonly messageCallbacks = new Map<
    string,
    Set<(message: unknown) => void>
  >();
  private readonly leaveCallbacks = new Set<(code: number) => void>();
  private hasLeft = false;

  constructor() {
    this.engine = new GameEngine({
      clock: this.createClock(),
      broadcast: (type, message) => this.emitMessage(type, message),
    });

    const state = this.engine.state;
    state.roomId = this.roomId;
    state.isSinglePlay = true;

    const me = new Player();
    me.sessionId = LOCAL_SESSION_ID;
    me.name = PLAYER_NAME;
    me.seatId = 1;
    me.isOwner = true;
    state.players.set(me.sessionId, me);
    for (const seatId of CPU_SEATS) {
      this.engine.addCPUPlayer(CPU_NAME, seatId);
    }

    this.encoder = new Encoder(state);
    this.patchTimer = setInterval(() => this.flushChanges(), PATCH_INTERVAL);
  }

  get state(): GameState {
    return this.engine.state;
  }

  send(type: string, message?: unknown): void {
    if (this.hasLeft) return;
    // サーバーと同じく、操作は呼び出し元の処理が終わってから実行する
    queueMicrotask(() => {
      if (this.hasLeft) return;
      if (type === "leaveRoom") {
        this.leave();
        return;
      }
      this.engine.handleAction(this.sessionId, type, message);
    });
  }

  onStateChange = Object.assign(
    (callback: StateCallback) => {
      this.stateCallbacks.add(callback);
    },
    {
      remove: (callback: StateCallback) => {
        this.stateCallbacks.delete(callback);
      },
    },
  );

  onMessage<T = unknown>(type: string, callback: (message: T) => void): void {
    let callbacks = this.messageCallbacks.get(type);
    if (!callbacks) {
      callbacks = new Set();
      this.messageCallbacks.set(type, callbacks);
    }
    callbacks.add(callback as (message: unknown) => void);
  }

  onLeave(callback: (code: number) => void): void {
    this.leaveCallbacks.add(callback);
  }

  /**
   * ゲームを終了する（タイマーとCPUの行動を止める）
   */
  leave(): void {
    if (this.hasLeft) return;
    this.hasLeft = true;

    this.engine.stop();
    clearInterval(this.patchTimer);
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts.clear();

    for (const callback of this.leaveCallbacks) {
      callback(LEAVE_CODE_CONSENTED);
    }
  }

  /**
   * 演出の待ち時間に使うタイマー（退席時にまとめて止められるよう記録する）
   */
  private createClock(): Clock {
    return {
      setTimeout: (callback, delay) => {
        const id = setTimeout(() => {
          this.timeouts.delete(id);
          callback();
        }, delay);
        this.timeouts.add(id);
        return {
          clear: () => {
            clearTimeout(id);
            this.timeouts.delete(id);
          },
        };
      },
    };
  }

  /**
   * アニメーション用のイベントを画面に届ける
   * （状態の変化より先に届くので、カードが消える前に位置を測れる）
   */
  private emitMessage(type: string, message: unknown): void {
    const callbacks = this.messageCallbacks.get(type);
    if (!callbacks) return;
    for (const callback of callbacks) {
      callback(message);
    }
  }

  /**
   * 前回から状態が変わっていれば画面に知らせる
   */
  private flushChanges(): void {
    if (!this.encoder.hasChanges) return;
    this.encoder.encode();
    this.encoder.discardChanges();

    for (const callback of this.stateCallbacks) {
      callback(this.state);
    }
  }
}
