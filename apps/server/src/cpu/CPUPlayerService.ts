import type { Dispatcher } from "@colyseus/command";
import type { GameState, Player } from "@dobon-uno/shared";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { SkipDobonCommand } from "../commands/SkipDobonCommand";
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
  private dobonReturnDelay = 3000; // ドボン返しの遅延（ms）
  private dobonDecisionDelay = 1000; // ドボンする・しないを決めるまでの遅延（ms）

  // ドボン・ドボン返しの宣言を待っているCPU（二重に宣言しないため）
  private pendingDobonDecision = new Set<string>();

  constructor(
    private readonly log: GameLog,
    decider?: ActionDecider,
  ) {
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
    // （ドボン・ドボン返しは handleDobonDecision で扱う）
    if (!hasAnyAction(cpuPlayer)) return;

    // 考えている間にドボンなどで手番が終わっていれば何もしない
    const stillMyTurn = () =>
      state.phase === "playing" &&
      state.currentTurnPlayerId === cpuPlayer.sessionId &&
      hasAnyAction(cpuPlayer);
    if (!stillMyTurn()) return;

    try {
      // 先読みの時間を思考時間の演出と重ねる（ホスト設定の思考時間）
      const eventCount = this.log.getEvents().length;
      const [decision] = await Promise.all([
        this.decider.decide(state, cpuPlayer),
        this.delay(state.cpuThinkingTime),
      ]);
      // 考えている間に場が動いていたら、その判断は使わない
      if (!stillMyTurn() || this.log.getEvents().length !== eventCount) return;
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
   * ドボン待ち・ドボン返し待ちでの判断（手番かどうかに関わらない。カットインはしない）
   * ドボンできるときは、ドボンするかしないかを必ず宣言してゲーム進行を再開させる
   */
  async handleDobonDecision(
    state: GameState,
    cpuPlayer: Player,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    const { sessionId } = cpuPlayer;
    if (this.pendingDobonDecision.has(sessionId)) return;

    if (cpuPlayer.canDobonReturn) {
      this.pendingDobonDecision.add(sessionId);
      try {
        await this.delay(this.dobonReturnDelay);
        dispatcher.dispatch(new DobonReturnCommand(), { sessionId });
      } finally {
        this.pendingDobonDecision.delete(sessionId);
      }
      return;
    }

    if (!cpuPlayer.canDobon) return;

    // ドボン返しされそうなら見送る
    const wantsDobon = this.wantsDobon(state, cpuPlayer);
    this.pendingDobonDecision.add(sessionId);
    try {
      await this.delay(this.dobonDecisionDelay);
      // 待っている間にドボン待ちが終わっていれば、validateで弾かれる
      dispatcher.dispatch(
        wantsDobon ? new DobonCommand() : new SkipDobonCommand(),
        { sessionId },
      );
    } finally {
      this.pendingDobonDecision.delete(sessionId);
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
