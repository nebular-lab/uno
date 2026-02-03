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
 * ドボン返しを宣言するCommand
 *
 * ドボン返しの点数計算:
 * - ドボンした人が、ドボン返しした人に「全員の手札の合計点数」を支払う
 * - 複数人がドボンしていた場合、それぞれが支払う
 */
export class DobonReturnCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    // フェーズチェック
    if (this.state.phase !== "playing") return false;

    // プレイヤーの存在チェック
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // ドボン返し可能かチェック
    if (!player.canDobonReturn) return false;

    // ドボンターゲットであることをチェック（自分がドボンされた側であること）
    if (this.state.dobonTargetId !== sessionId) return false;

    return true;
  }

  execute({ sessionId }: Payload) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    // タイマー停止
    this.room.turnTimerService.stopTimer(this.state.currentTurnPlayerId);

    // ドボン返しフラグをオフに
    player.canDobonReturn = false;

    // ドボン返し確定 → 点数計算
    this.finalizeDobonReturn(sessionId);
  }

  /**
   * ドボン返し確定処理（点数計算、result遷移）
   */
  private finalizeDobonReturn(dobonReturnPlayerId: string): void {
    // フェーズをresultに変更
    this.state.phase = "result";

    // 点数計算
    const rateMultiplier = this.state.rateMultiplier;

    // 全員の手札合計点数を計算（ドボンされた人が出したカードの点数も含む）
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    const fieldCardPoints = fieldCard
      ? fieldCard.points * this.state.lastPlayedCount
      : 0;
    const totalHandPoints =
      calculateTotalHandPoints(this.state) + fieldCardPoints;

    const scoreChanges = new Map<string, number>();

    // ドボン返しした人に加算
    const winner = this.state.players.get(dobonReturnPlayerId);
    const dobonPlayerCount = this.state.dobonPlayerIds.length;
    const totalWinnings = totalHandPoints * rateMultiplier * dobonPlayerCount;

    if (winner) {
      winner.score += totalWinnings;
      scoreChanges.set(dobonReturnPlayerId, totalWinnings);
    }

    // ドボンした人からスコアを引く
    const loss = totalHandPoints * rateMultiplier;
    for (const dobonPlayerId of this.state.dobonPlayerIds) {
      const dobonPlayer = this.state.players.get(dobonPlayerId);
      if (dobonPlayer) {
        dobonPlayer.score -= loss;
        scoreChanges.set(dobonPlayerId, -loss);
      }
    }

    // GameResultを作成してgameHistoryに追加
    const gameResult = createGameResult(
      this.state,
      dobonReturnPlayerId,
      "dobonReturn",
      scoreChanges,
    );
    this.state.gameHistory.push(gameResult);

    // 次のゲームの最初のプレイヤーを設定（ドボン返しした人）
    this.state.nextGameStartPlayerId = dobonReturnPlayerId;

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
