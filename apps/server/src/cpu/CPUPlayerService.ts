import type { Dispatcher } from "@colyseus/command";
import type { GameState, Player } from "@dobon-uno/shared";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import type { GameRoom } from "../rooms/GameRoom";
import type { ActionDecider } from "./ActionDecider";
import { createActionDecider } from "./createActionDecider";
import {
  executeDecision,
  fallbackDecision,
  hasAnyAction,
} from "./executeDecision";
import type { GameLog } from "./GameLog";

export class CPUPlayerService {
  private decider: ActionDecider;
  private thinkingDelay = 3000;
  private quickActionDelay = 200; // 即決アクションの遅延（ms）
  private dobonReturnDelay = 3000; // ドボン返しの遅延（ms）
  private dobonWaitDelay = 5000; // 他プレイヤーのドボン待ち時間（ms）
  private offTurnDobonDelay = 1000; // 手番外のドボンの遅延（ms）

  // 手番外のドボン・ドボン返しを待っているCPU（二重に宣言しないため）
  private pendingOffTurn = new Set<string>();

  constructor(log: GameLog, decider?: ActionDecider) {
    this.decider = decider ?? createActionDecider(log);
  }

  async handleTurn(
    state: GameState,
    cpuPlayer: Player,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    // CPUプレイヤーでない場合は何もしない
    if (!cpuPlayer.isCpu) return;

    // ドボン待ちなどで取れる行動がない
    if (!hasAnyAction(cpuPlayer)) return;

    // ドボン返しが可能な場合は3秒後に実行
    if (cpuPlayer.canDobonReturn) {
      await this.delay(this.dobonReturnDelay);
      await dispatcher.dispatch(new DobonReturnCommand(), {
        sessionId: cpuPlayer.sessionId,
      });
      return;
    }

    // ドボンが可能な場合は即座に実行（ドボン返しされそうなら見送って手番を続ける）
    if (cpuPlayer.canDobon && this.wantsDobon(state, cpuPlayer)) {
      await this.delay(this.quickActionDelay);
      await dispatcher.dispatch(new DobonCommand(), {
        sessionId: cpuPlayer.sessionId,
      });
      return;
    }

    // 他のプレイヤーがドボン可能かチェック
    const otherPlayersCanDobon = this.checkOtherPlayersCanDobon(
      state,
      cpuPlayer.sessionId,
    );

    // 他のプレイヤーがドボン可能な場合は5秒待つ
    if (otherPlayersCanDobon) {
      await this.delay(this.dobonWaitDelay);
    }

    // 思考時間の演出
    await this.delay(this.thinkingDelay);

    // 待っている間にドボンなどで手番が終わっていれば何もしない
    if (
      state.phase !== "playing" ||
      state.currentTurnPlayerId !== cpuPlayer.sessionId ||
      !hasAnyAction(cpuPlayer)
    ) {
      return;
    }

    try {
      const decision = await this.decider.decide(state, cpuPlayer);
      executeDecision(decision, cpuPlayer.sessionId, dispatcher);
    } catch (error) {
      console.error("CPU decision error:", error);
      // フォールバック: 可能なアクションを順に試す
      const fallback = fallbackDecision(cpuPlayer);
      if (fallback) {
        executeDecision(fallback, cpuPlayer.sessionId, dispatcher);
      }
    }
  }

  /**
   * 手番でないときのドボン・ドボン返し（カットインはしない）
   */
  async handleOffTurn(
    state: GameState,
    cpuPlayer: Player,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    const { sessionId } = cpuPlayer;
    if (this.pendingOffTurn.has(sessionId)) return;

    if (cpuPlayer.canDobonReturn) {
      this.pendingOffTurn.add(sessionId);
      try {
        await this.delay(this.dobonReturnDelay);
        dispatcher.dispatch(new DobonReturnCommand(), { sessionId });
      } finally {
        this.pendingOffTurn.delete(sessionId);
      }
      return;
    }

    if (!cpuPlayer.canDobon || !this.wantsDobon(state, cpuPlayer)) return;

    this.pendingOffTurn.add(sessionId);
    try {
      await this.delay(this.offTurnDobonDelay);
      // 待っている間に次の人が動いてドボンできなくなっていれば、validateで弾かれる
      dispatcher.dispatch(new DobonCommand(), { sessionId });
    } finally {
      this.pendingOffTurn.delete(sessionId);
    }
  }

  private wantsDobon(state: GameState, cpuPlayer: Player): boolean {
    try {
      return this.decider.decideDobon?.(state, cpuPlayer) ?? true;
    } catch (error) {
      console.error("CPU dobon decision error:", error);
      return true;
    }
  }

  private checkOtherPlayersCanDobon(
    state: GameState,
    cpuSessionId: string,
  ): boolean {
    for (const [sessionId, player] of state.players.entries()) {
      if (sessionId !== cpuSessionId && player.canDobon) {
        return true;
      }
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
