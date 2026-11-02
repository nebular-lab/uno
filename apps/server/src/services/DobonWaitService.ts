import { SkipDobonCommand } from "../commands/SkipDobonCommand";
import type { GameRoom } from "../rooms/GameRoom";

/**
 * ドボン待ちを開始するサービス
 *
 * カードが出されてドボンできる人がいる場合、全員のゲーム進行アクションを止めて、
 * ドボンできる人それぞれの判断（ドボンする / ドボンしない）を待つ。
 * 判断が出揃った後の処理は ResolveDobonWaitCommand が担当する。
 */
export class DobonWaitService {
  constructor(private readonly room: GameRoom) {}

  /**
   * ドボンできる人がいればドボン待ちを開始する
   * PlayerActionUpdater などで canDobon を計算した後に呼び出す
   * @returns ドボン待ちを開始したか
   */
  startIfNeeded(): boolean {
    const state = this.room.state;
    const deciders = Array.from(state.players.values()).filter(
      (p) => p.canDobon,
    );
    if (deciders.length === 0) return false;

    state.waitingForDobon = true;

    // 手番のタイマーを止め、ドボン以外のアクションをすべて無効化する
    this.room.turnTimerService.stopTimer(state.currentTurnPlayerId);
    for (const p of state.players.values()) {
      p.playableCards.clear();
      p.canDraw = false;
      p.canDrawStack = false;
      p.canChooseColor = false;
      p.canPass = false;
    }

    // ドボンできる人ごとにタイマーを開始（時間切れはドボンしない扱い）
    for (const p of deciders) {
      const sessionId = p.sessionId;
      this.room.turnTimerService.startTimer(sessionId, () => {
        this.room.dispatcher.dispatch(new SkipDobonCommand(), { sessionId });
      });
    }

    // CPUのドボン判断
    this.room.checkCPUTurn();
    return true;
  }
}
