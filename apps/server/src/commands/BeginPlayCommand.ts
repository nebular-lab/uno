import { Command } from "@colyseus/command";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";
import { CardEffectContextFactory } from "../services/CardEffectContextFactory";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";

/**
 * プレイフェーズを開始するCommand
 * revealingフェーズ完了後に実行され、playingフェーズに移行する
 */
export class BeginPlayCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "playing";

    // 最初のカードの効果を適用（ドロー4の場合は色選択状態にする等）
    const firstCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (firstCard) {
      const effect = CardEffectRegistry.getEffectForCard(firstCard);
      const contextFactory = new CardEffectContextFactory(this.state);
      const context = contextFactory.create(firstCard);
      effect.applyOnBeginPlay(context);
    }

    // 最初のカードがワイルドの場合、すべてのカードを出せる
    const isFirstCardWild =
      this.state.fieldCards.length === 1 && firstCard?.value === "wild";

    // 各プレイヤーのアクション可否を更新
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({ isFirstCardWild });

    // タイマー開始
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
