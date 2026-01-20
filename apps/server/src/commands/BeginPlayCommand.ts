import { Command } from "@colyseus/command";
import type { Card, Player } from "@dobon-uno/shared";
import type { GameRoom } from "../rooms/GameRoom";

/**
 * プレイフェーズを開始するCommand
 * revealingフェーズ完了後に実行され、playingフェーズに移行する
 */
export class BeginPlayCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "playing";

    // 最初のカードがドロー4の場合のみ、色選択状態にする
    // ワイルドの場合は色選択不要（手番プレイヤーが最初にカードを出すときに色が決まる）
    const firstCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (firstCard && firstCard.value === "draw4") {
      this.state.waitingForColorChoice = true;
    }

    // 各プレイヤーのアクション可否を更新
    this.updatePlayerActions();
  }

  /**
   * 全プレイヤーのアクション可否を更新する
   */
  private updatePlayerActions() {
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];

    for (const [sessionId, player] of this.state.players.entries()) {
      const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;

      if (isCurrentTurn) {
        // 手番プレイヤーのアクション設定
        player.canDraw =
          !this.state.waitingForColorChoice && this.state.drawStack === 0;
        player.canDrawStack = this.state.drawStack > 0;
        player.canChooseColor = this.state.waitingForColorChoice;
        player.canPass = false;
        player.canDobonReturn = false;

        // 出せるカードを計算
        this.calculatePlayableCards(player, true);

        // ドボン判定（手番プレイヤーもドボン可能）
        player.canDobon = this.canDobon(player, fieldCard);
      } else {
        // 手番でないプレイヤー
        player.canDraw = false;
        player.canDrawStack = false;
        player.canChooseColor = false;
        player.canPass = false;
        player.canDobonReturn = false;

        // カットイン用の出せるカードを計算
        this.calculatePlayableCards(player, false);

        // ドボン判定
        player.canDobon = this.canDobon(player, fieldCard);
      }
    }
  }

  /**
   * プレイヤーが出せるカードを計算する
   * @param player プレイヤー
   * @param isCurrentTurn 手番プレイヤーかどうか
   */
  private calculatePlayableCards(player: Player, isCurrentTurn: boolean) {
    player.playableCards.clear();

    // 色選択待ちの場合
    // ただし、ドロー累積中はドローカードを重ねられる
    if (this.state.waitingForColorChoice && this.state.drawStack === 0) {
      return;
    }

    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (!fieldCard) return;

    for (const card of player.myHand) {
      if (isCurrentTurn) {
        // 手番プレイヤーの判定
        if (this.canPlayCard(card, fieldCard)) {
          player.playableCards.set(card.id, true);
        }
      } else {
        // 手番でないプレイヤーはカットインのみ（同じカードのみ出せる）
        if (this.canCutIn(card, fieldCard)) {
          player.playableCards.set(card.id, true);
        }
      }
    }
  }

  /**
   * 手番プレイヤーがカードを出せるかどうかを判定する
   */
  private canPlayCard(
    card: { color: string; value: string },
    fieldCard: { color: string; value: string },
  ): boolean {
    // ドロー累積中の場合、出せるカードが制限される
    if (this.state.drawStack > 0) {
      return this.canPlayCardOnDrawStack(card, fieldCard);
    }

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

  /**
   * ドロー累積中に出せるカードかどうかを判定する
   */
  private canPlayCardOnDrawStack(
    card: { color: string; value: string },
    fieldCard: { color: string; value: string },
  ): boolean {
    // draw4にはdraw4のみ重ねられる
    if (fieldCard.value === "draw4") {
      return card.value === "draw4";
    }

    // draw2にはdraw2またはdraw4を重ねられる
    if (fieldCard.value === "draw2") {
      return card.value === "draw2" || card.value === "draw4";
    }

    return false;
  }

  /**
   * カットインできるかどうかを判定する
   * 同じカード（色と数字/記号が完全一致、またはワイルド同士・ドロー4同士・強制色変え同士）のみ
   */
  private canCutIn(
    card: { color: string; value: string },
    fieldCard: { color: string; value: string },
  ): boolean {
    // ワイルド同士
    if (card.color === "wild" && fieldCard.color === "wild") {
      // ワイルド同士、ドロー4同士は同じvalueでカットイン可能
      return card.value === fieldCard.value;
    }

    // 強制色変え同士
    if (card.value === "force-change" && fieldCard.value === "force-change") {
      return true;
    }

    // 色と数字/記号が完全一致
    return card.color === fieldCard.color && card.value === fieldCard.value;
  }

  /**
   * ドボンできるかどうかを判定する
   * 場のカードの点数と手札の合計点数が一致すればドボン可能
   */
  private canDobon(player: Player, fieldCard: Card | null): boolean {
    if (!fieldCard) return false;

    // 手札の合計点数を計算
    let handTotal = 0;
    for (const card of player.myHand) {
      handTotal += card.points;
    }

    // 場のカードの点数と一致すればドボン可能
    return handTotal === fieldCard.points;
  }
}
