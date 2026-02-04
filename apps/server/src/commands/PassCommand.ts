import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import { advanceToNextPlayer } from "../utils/playerActions";

interface Payload {
  sessionId: string;
}

export class PassCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    const player = this.state.players.get(sessionId);
    return player?.canPass ?? false;
  }

  execute({ sessionId }: Payload) {
    // タイマー停止
    this.room.turnTimerService.stopTimer(sessionId);

    // ドローフラグをリセット
    this.state.hasDrawnThisTurn = false;

    // 次のプレイヤーに手番を移す
    advanceToNextPlayer(this.state);

    // 全プレイヤーのアクション状態を更新
    // 色が未決定（最初のカードがwild/draw4で引いた場合等）なら何でも出せる
    const isColorNotSet = this.state.currentColor === "";
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    const totalPlayedPoints = fieldCard
      ? fieldCard.points * this.state.lastPlayedCount
      : undefined;
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({
      isFirstCardWild: isColorNotSet,
      cardPlayerId: this.state.dobonTargetId || undefined,
      totalPlayedPoints,
    });

    // 次のプレイヤーのタイマーを開始
    this.startCurrentPlayerTimer();

    // CPUプレイヤーのターンをチェック
    this.room.checkCPUTurn();
  }

  /**
   * 現在の手番プレイヤーのタイマーを開始する
   */
  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;
    const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      timeoutHandler.handle(currentPlayerId);
    });
  }
}
