import { Command } from "@colyseus/command";
import type { Card } from "@dobon-uno/shared";
import { TIMING } from "../config/timing";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";
import { CardEffectContextFactory } from "../services/CardEffectContextFactory";
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
      const effect = CardEffectRegistry.getEffectForCard(firstCard);
      const contextFactory = new CardEffectContextFactory(this.state);
      const context = contextFactory.create(firstCard);
      effect.applyOnReveal(context);
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
}
