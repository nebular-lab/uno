import { Command } from "@colyseus/command";
import type { Player } from "@dobon-uno/shared";
import type { GameRoom } from "../rooms/GameRoom";

/**
 * プレイフェーズを開始するCommand
 * revealingフェーズ完了後に実行され、playingフェーズに移行する
 */
export class BeginPlayCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "playing";

    // 最初のカードがワイルド/ドロー4の場合、色選択状態にする
    const firstCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (
      firstCard &&
      (firstCard.value === "wild" || firstCard.value === "draw4")
    ) {
      this.state.waitingForColorChoice = true;
    }

    // 各プレイヤーのアクション可否を更新
    this.updatePlayerActions();
  }

  /**
   * 全プレイヤーのアクション可否を更新する
   */
  private updatePlayerActions() {
    for (const [sessionId, player] of this.state.players.entries()) {
      const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;

      if (isCurrentTurn) {
        // 手番プレイヤーのアクション設定
        player.canDraw =
          !this.state.waitingForColorChoice && this.state.drawStack === 0;
        player.canDrawStack = this.state.drawStack > 0;
        player.canChooseColor = this.state.waitingForColorChoice;
        player.canPass = false;
        player.canDobon = false;
        player.canDobonReturn = false;

        // 出せるカードを計算
        this.calculatePlayableCards(player);
      } else {
        // 手番でないプレイヤー
        player.canDraw = false;
        player.canDrawStack = false;
        player.canChooseColor = false;
        player.canPass = false;
        player.canDobon = false; // TODO: ドボン判定
        player.canDobonReturn = false;
        player.playableCards.clear();
      }
    }
  }

  /**
   * プレイヤーが出せるカードを計算する
   */
  private calculatePlayableCards(player: Player) {
    player.playableCards.clear();

    // 色選択待ちの場合は出せない
    if (this.state.waitingForColorChoice) {
      return;
    }

    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (!fieldCard) return;

    for (const card of player.myHand) {
      if (this.canPlayCard(card, fieldCard)) {
        player.playableCards.set(card.id, true);
      }
    }
  }

  /**
   * カードが出せるかどうかを判定する
   */
  private canPlayCard(
    card: { color: string; value: string },
    fieldCard: { color: string; value: string },
  ): boolean {
    // ワイルドカードは常に出せる
    if (card.color === "wild") return true;

    // 強制色変えカードは常に出せる
    if (card.value === "force-change") return true;

    // 色が一致
    if (card.color === this.state.currentColor) return true;

    // 数字/記号が一致
    if (card.value === fieldCard.value) return true;

    return false;
  }
}
