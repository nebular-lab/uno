import type { Dispatcher } from "@colyseus/command";
import type { GameState, Player } from "@dobon-uno/shared";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { SkipDobonCommand } from "../commands/SkipDobonCommand";
import type { GameRoom } from "../rooms/GameRoom";
import type { ActionDecider, CPUDecision } from "./ActionDecider";
import { createActionDecider } from "./createActionDecider";
import {
  executeDecision,
  fallbackDecision,
  hasAnyAction,
} from "./executeDecision";
import type { GameLog, GameLogEvent } from "./GameLog";

export class CPUPlayerService {
  private decider: ActionDecider;
  private dobonReturnDelay = 3000; // ドボン返しの遅延（ms）
  private dobonDecisionDelay = 1000; // ドボンする・しないを決めるまでの遅延（ms）
  private cutInDelay = 1000; // カットインするまでの遅延（ms）

  // ドボン・ドボン返しの宣言を待っているCPU（二重に宣言しないため）
  private pendingDobonDecision = new Set<string>();

  // CPUごとに、最後にカットインを判断した場面（最後の行動履歴）。同じ場面で判断し直さないため
  private cutInJudgedAt = new Map<string, GameLogEvent | undefined>();

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
   * ドボン待ち・ドボン返し待ちでの判断（手番かどうかに関わらない）
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

  /**
   * 手番でないときのカットイン。出せるカードがあっても、出さない方が良ければ見送る。
   * カットインするときは1秒待ち、その間に場が動いていなければカードを出す。
   */
  async handleCutIn(
    state: GameState,
    cpuPlayer: Player,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    const { sessionId } = cpuPlayer;
    if (!this.canCutIn(state, cpuPlayer)) return;

    // 場面は最後の行動履歴で見分ける（カードが出る・引く・パス・色選択のたびに変わる）
    const scene = this.log.getEvents().at(-1);
    if (
      this.cutInJudgedAt.has(sessionId) &&
      this.cutInJudgedAt.get(sessionId) === scene
    ) {
      return;
    }
    this.cutInJudgedAt.set(sessionId, scene);

    const decision = this.wantsCutIn(state, cpuPlayer);
    if (!decision) return;

    await this.delay(this.cutInDelay);
    // 待っている間に場が動いた・ドボン待ちになった・手番が回ってきた場合は出さない
    if (this.log.getEvents().at(-1) !== scene) return;
    if (!this.canCutIn(state, cpuPlayer)) return;
    executeDecision(decision, sessionId, dispatcher);
  }

  private canCutIn(state: GameState, cpuPlayer: Player): boolean {
    if (!cpuPlayer.isCpu) return false;
    if (state.phase !== "playing" || state.waitingForDobon) return false;
    if (state.currentTurnPlayerId === cpuPlayer.sessionId) return false;
    for (const p of state.players.values()) {
      if (p.canDobonReturn) return false;
    }
    let hasPlayable = false;
    cpuPlayer.playableCards.forEach((canPlay) => {
      if (canPlay) hasPlayable = true;
    });
    return hasPlayable;
  }

  private wantsCutIn(
    state: GameState,
    cpuPlayer: Player,
  ): CPUDecision | undefined {
    try {
      return this.decider.decideCutIn?.(state, cpuPlayer);
    } catch (error) {
      console.error("CPU cut-in decision error:", error);
      return undefined;
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
