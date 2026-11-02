import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { revealHand } from "../utils/finishGame";
import { ResolveDobonWaitCommand } from "./ResolveDobonWaitCommand";

interface Payload {
  sessionId: string;
}

/**
 * ドボンを宣言するCommand
 *
 * ドボンできる人が複数いる場合は、全員の判断（ドボンする / しない）が出揃ってから
 * ResolveDobonWaitCommand でドボン返しの判定・点数計算を行う。
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

    // タイマー停止（ドボン待ちでなければ手番のタイマーも止める）
    this.room.turnTimerService.stopTimer(sessionId);
    if (!this.state.waitingForDobon) {
      this.room.turnTimerService.stopTimer(this.state.currentTurnPlayerId);
    }

    // 色選択状態をキャンセル（ドボンが優先）
    this.state.waitingForColorChoice = false;

    // ドボンしたプレイヤーを記録し、手札を公開
    this.state.dobonPlayerIds.push(sessionId);
    player.canDobon = false;
    revealHand(player);

    // ドボンされた人を特定（カードを出した人 = currentTurnPlayerId）
    if (this.state.dobonTargetId === "") {
      this.state.dobonTargetId = this.state.currentTurnPlayerId;
    }

    // ゲーム進行を中断: 全プレイヤーのアクションを無効化（ドボン返し可能者を除く）
    this.disableAllPlayerActions();

    // 他のドボンできる人の判断を待ってから、ドボン返しの判定・点数計算を行う
    this.room.dispatcher.dispatch(new ResolveDobonWaitCommand());
  }

  /**
   * 全プレイヤーのゲーム進行アクションを無効化する
   * カード出し、ドロー、色選択、パスをすべて停止する
   */
  private disableAllPlayerActions(): void {
    for (const p of this.state.players.values()) {
      p.playableCards.clear();
      p.canDraw = false;
      p.canDrawStack = false;
      p.canChooseColor = false;
      p.canPass = false;
    }
  }
}
