import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import {
  calculateTotalHandPoints,
  createGameResult,
  RESULT_DISPLAY_DURATION,
} from "../utils/finishGame";
import { NormalFinishCommand } from "./NormalFinishCommand";

/**
 * ドボン待ちの判断が出揃ったかを確認し、結果に応じてゲームを進めるCommand
 *
 * - まだ判断していない人がいる → 待ち続ける
 * - 誰かがドボンした → ドボン返しの判定、または点数計算
 * - 誰もドボンしなかった → 上がりカードなら上がり確定、それ以外はゲーム再開
 *
 * ドボンの点数計算:
 * - ドボンされた人が、ドボンした人に「全員の手札の合計点数」を支払う
 * - 「全員」にはドボンした人の手札も含む
 * - ドボンされた人が出したカードの点数も含む
 * - 複数人がドボンした場合、それぞれに全員分を支払う
 */
export class ResolveDobonWaitCommand extends Command<GameRoom> {
  validate(): boolean {
    return this.state.phase === "playing";
  }

  execute() {
    // まだドボンするか決めていない人がいれば待つ
    for (const player of this.state.players.values()) {
      if (player.canDobon) return;
    }

    this.state.waitingForDobon = false;

    if (this.state.dobonPlayerIds.length > 0) {
      this.room.turnTimerService.stopAllTimers();
      if (this.checkCanDobonReturn()) {
        this.setupDobonReturnWait();
      } else {
        this.finalizeDobonFinish();
      }
      return;
    }

    // 誰もドボンしなかった場合、上がりカードなら上がり確定
    const target = this.state.players.get(this.state.dobonTargetId);
    if (target && target.handCount === 0) {
      this.room.dispatcher.dispatch(new NormalFinishCommand(), {
        sessionId: target.sessionId,
      });
      return;
    }

    this.resumePlay();
  }

  /**
   * ゲーム進行を再開する（止めていたアクションを計算し直し、手番のタイマーを開始する）
   */
  private resumePlay(): void {
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    // 最初の場札がワイルドの場合、すべてのカードを出せる（BeginPlayCommandと同じ判定）
    const isFirstCardWild =
      this.state.fieldCards.length === 1 && fieldCard?.value === "wild";
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({
      isFirstCardWild,
      cardPlayerId: this.state.dobonTargetId || undefined,
      totalPlayedPoints: fieldCard
        ? fieldCard.points * this.state.lastPlayedCount
        : undefined,
    });

    const currentPlayerId = this.state.currentTurnPlayerId;
    const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);
    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      timeoutHandler.handle(currentPlayerId);
    });

    this.room.checkCPUTurn();
  }

  /**
   * ドボン返し可能かチェック
   * ドボンされた人の残り手札の合計点数と、ドボンした人の手札の合計点数が一致すれば可能
   */
  private checkCanDobonReturn(): boolean {
    const target = this.state.players.get(this.state.dobonTargetId);
    if (!target) return false;

    // ドボンされた人の残り手札合計
    const targetHandTotal = target.myHand.reduce(
      (sum, card) => sum + card.points,
      0,
    );

    // ドボンした人のいずれかの手札合計と一致するかチェック
    for (const dobonPlayerId of this.state.dobonPlayerIds) {
      const dobonPlayer = this.state.players.get(dobonPlayerId);
      if (!dobonPlayer) continue;

      const dobonPlayerHandTotal = dobonPlayer.myHand.reduce(
        (sum, card) => sum + card.points,
        0,
      );

      if (targetHandTotal === dobonPlayerHandTotal) {
        return true;
      }
    }

    return false;
  }

  /**
   * ドボン返し待ち状態をセットアップ
   */
  private setupDobonReturnWait(): void {
    const target = this.state.players.get(this.state.dobonTargetId);
    if (!target) {
      // ターゲットが見つからない場合はドボン確定
      this.finalizeDobonFinish();
      return;
    }

    // ドボンされた人のcanDobonReturnをtrueに
    target.canDobonReturn = true;

    // タイマーを開始してドボン返しを待つ
    // タイムアウト時はドボン確定
    this.room.turnTimerService.startTimer(this.state.dobonTargetId, () => {
      // タイムアウト時、まだcanDobonReturnがtrueなら（ドボン返ししなかった）
      const targetPlayer = this.state.players.get(this.state.dobonTargetId);
      if (targetPlayer?.canDobonReturn) {
        targetPlayer.canDobonReturn = false;
        this.finalizeDobonFinish();
      }
    });

    // CPUプレイヤーのドボン返しをチェック
    this.room.checkCPUTurn();
  }

  /**
   * ドボン確定処理（点数計算、result遷移）
   */
  private finalizeDobonFinish(): void {
    // フェーズをresultに変更（公開するのはドボンした人の手札のみ）
    this.state.phase = "result";

    // 点数計算
    const rateMultiplier = this.state.rateMultiplier;

    // 全員の手札合計点数を計算（ドボンされた人が出したカードの点数も含む）
    // 場のカードの点数を加算
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    const fieldCardPoints = fieldCard
      ? fieldCard.points * this.state.lastPlayedCount
      : 0;
    const totalHandPoints =
      calculateTotalHandPoints(this.state) + fieldCardPoints;

    const scoreChanges = new Map<string, number>();

    // ドボンされた人の損失を計算
    const targetId = this.state.dobonTargetId;
    const dobonPlayerCount = this.state.dobonPlayerIds.length;
    const totalLoss = totalHandPoints * rateMultiplier * dobonPlayerCount;

    // ドボンされた人からスコアを引く
    const target = this.state.players.get(targetId);
    if (target) {
      target.score -= totalLoss;
      scoreChanges.set(targetId, -totalLoss);
    }

    // ドボンした人にスコアを加算
    const winnings = totalHandPoints * rateMultiplier;
    let firstDobonPlayerId = "";
    for (const dobonPlayerId of this.state.dobonPlayerIds) {
      const dobonPlayer = this.state.players.get(dobonPlayerId);
      if (dobonPlayer) {
        dobonPlayer.score += winnings;
        scoreChanges.set(dobonPlayerId, winnings);
        if (firstDobonPlayerId === "") {
          firstDobonPlayerId = dobonPlayerId;
        }
      }
    }

    // GameResultを作成してgameHistoryに追加
    // 複数人ドボンの場合、最初にドボンした人をwinnerIdとする
    const gameResult = createGameResult(
      this.state,
      firstDobonPlayerId,
      "dobon",
      scoreChanges,
    );
    this.state.gameHistory.push(gameResult);

    // 次のゲームの最初のプレイヤーを設定（最初にドボンした人）
    this.state.nextGameStartPlayerId = firstDobonPlayerId;

    // レート倍率をリセット
    this.state.rateMultiplier = 1;
    this.state.consecutiveDeckouts = 0;

    // 一定時間後にwaitingフェーズに戻る
    this.clock.setTimeout(() => {
      this.room.resetGameState();
      this.state.phase = "waiting";
    }, RESULT_DISPLAY_DURATION);
  }
}
