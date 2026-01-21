import { Command } from "@colyseus/command";
import type { Card, Player } from "@dobon-uno/shared";
import type { CardEffectContext } from "../effects";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";

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
      this.applyBeginPlayEffect(firstCard);
    }

    // 各プレイヤーのアクション可否を更新
    this.updatePlayerActions();
  }

  /**
   * プレイフェーズ開始時のカード効果を適用（ストラテジーパターン）
   */
  private applyBeginPlayEffect(card: Card): void {
    const effect = CardEffectRegistry.getEffectForCard(card);
    const context = this.createEffectContext(card);
    effect.applyOnBeginPlay(context);
  }

  /**
   * 効果コンテキストを作成する
   */
  private createEffectContext(card: Card): CardEffectContext {
    return {
      state: this.state,
      card,
      getPlayersSortedBySeat: () => this.getPlayersSortedBySeat(),
      advanceToNextPlayer: () => this.advanceToNextPlayer(),
    };
  }

  /**
   * プレイヤーを座席順でソートして取得
   */
  private getPlayersSortedBySeat() {
    return Array.from(this.state.players.values()).sort(
      (a, b) => a.seatId - b.seatId,
    );
  }

  /**
   * 次のプレイヤーに手番を進める
   */
  private advanceToNextPlayer() {
    const sortedBySeat = this.getPlayersSortedBySeat();
    const currentIndex = sortedBySeat.findIndex(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    const direction = this.state.turnDirection;
    const nextIndex =
      (currentIndex + direction + sortedBySeat.length) % sortedBySeat.length;
    this.state.currentTurnPlayerId = sortedBySeat[nextIndex].sessionId;
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
        this.calculatePlayableCards(player, fieldCard, true);

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
        this.calculatePlayableCards(player, fieldCard, false);

        // ドボン判定
        player.canDobon = this.canDobon(player, fieldCard);
      }
    }
  }

  /**
   * プレイヤーが出せるカードを計算する（ストラテジーパターン使用）
   * @param player プレイヤー
   * @param fieldCard 場のカード
   * @param isCurrentTurn 手番プレイヤーかどうか
   */
  private calculatePlayableCards(
    player: Player,
    fieldCard: Card | null,
    isCurrentTurn: boolean,
  ) {
    player.playableCards.clear();

    // 色選択待ちの場合（ただしドロー累積中はドローカードを重ねられる）
    if (this.state.waitingForColorChoice && this.state.drawStack === 0) {
      return;
    }

    if (!fieldCard) return;

    for (const card of player.myHand) {
      const effect = CardEffectRegistry.getEffectForCard(card);

      if (isCurrentTurn) {
        // 手番プレイヤーの判定
        if (this.canPlayCard(card, fieldCard, effect)) {
          player.playableCards.set(card.id, true);
        }
      } else {
        // 手番でないプレイヤーはカットインのみ
        if (effect.canCutIn(card, fieldCard)) {
          player.playableCards.set(card.id, true);
        }
      }
    }
  }

  /**
   * 手番プレイヤーがカードを出せるかどうかを判定する（ストラテジーパターン使用）
   */
  private canPlayCard(
    card: Card,
    fieldCard: Card,
    effect: ReturnType<typeof CardEffectRegistry.getEffectForCard>,
  ): boolean {
    // ドロー累積中の場合
    if (this.state.drawStack > 0) {
      return effect.canPlayOnDrawStack(card, fieldCard);
    }

    // 通常時
    return effect.canPlay(card, fieldCard, this.state.currentColor);
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
