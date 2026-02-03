import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import {
  calculateTotalHandPoints,
  createGameResult,
  RESULT_DISPLAY_DURATION,
} from "../utils/finishGame";

interface Payload {
  sessionId: string;
}

/**
 * ドボンを宣言するCommand
 *
 * ドボンの点数計算:
 * - ドボンされた人が、ドボンした人に「全員の手札の合計点数」を支払う
 * - 「全員」にはドボンした人の手札も含む
 * - ドボンされた人が出したカードの点数も含む
 * - 複数人がドボンした場合、それぞれに全員分を支払う
 */
export class DobonCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    // フェーズチェック
    if (this.state.phase !== "playing") return false;

    // プレイヤーの存在チェック
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // ドボン可能かチェック
    if (!player.canDobon) return false;

    return true;
  }

  execute({ sessionId }: Payload) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    // タイマー停止
    this.room.turnTimerService.stopTimer(this.state.currentTurnPlayerId);

    // ドボンしたプレイヤーを記録
    this.state.dobonPlayerIds.push(sessionId);
    player.canDobon = false;

    // ドボンされた人を特定（カードを出した人 = currentTurnPlayerId）
    if (this.state.dobonTargetId === "") {
      this.state.dobonTargetId = this.state.currentTurnPlayerId;
    }

    // 他にドボン可能なプレイヤーがいるかチェック
    const othersCanDobon = this.checkOthersCanDobon();
    if (othersCanDobon) {
      // 他のドボン待ち（タイマー継続）
      // TODO: ドボン待ちタイマーを実装（TimeoutHandler統合時）
      return;
    }

    // ドボン返し判定
    if (this.checkCanDobonReturn()) {
      // ドボン返し待ち状態に
      this.setupDobonReturnWait();
      return;
    }

    // ドボン確定 → 点数計算
    this.finalizeDobonFinish();
  }

  /**
   * 他にドボン可能なプレイヤーがいるかチェック
   */
  private checkOthersCanDobon(): boolean {
    for (const [, player] of this.state.players.entries()) {
      if (player.canDobon) {
        return true;
      }
    }
    return false;
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
  }

  /**
   * ドボン確定処理（点数計算、result遷移）
   */
  private finalizeDobonFinish(): void {
    // フェーズをresultに変更
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
