import { Command } from "@colyseus/command";
import type { Card } from "@dobon-uno/shared";
import { TIMING } from "../config/timing";
import type { CardEffectContext } from "../effects";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";
import { BeginPlayCommand } from "./BeginPlayCommand";

/**
 * 場札を公開するCommand
 * カウントダウン完了後に実行され、最初のカードを場に出して効果を適用する
 */
export class RevealCardCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "revealing";

    const firstCard = this.state.firstCard;
    if (firstCard) {
      // 場札に追加
      this.state.fieldCards.push(firstCard);
      // 現在の色を設定
      this.state.currentColor = this.getCardColor(firstCard);
      // 最初のカードの特殊効果を適用（ストラテジーパターン）
      this.applyCardEffect(firstCard);
    }

    // playingフェーズへ移行
    this.room.clock.setTimeout(() => {
      this.room.dispatcher.dispatch(new BeginPlayCommand());
    }, TIMING.REVEAL_DELAY);
  }

  /**
   * カードの色を取得する
   * ワイルドカードの場合は空文字（色選択待ち）
   */
  private getCardColor(card: Card): string {
    if (card.color === "wild") {
      return ""; // ワイルドの場合は色選択待ち（playingフェーズで選択）
    }
    return card.color;
  }

  /**
   * カードの効果を適用する（ストラテジーパターン）
   */
  private applyCardEffect(card: Card): void {
    const effect = CardEffectRegistry.getEffectForCard(card);
    const context = this.createEffectContext(card);
    effect.applyOnReveal(context);
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
   * 次のプレイヤーに手番を進める（スキップ時に使用）
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
}
