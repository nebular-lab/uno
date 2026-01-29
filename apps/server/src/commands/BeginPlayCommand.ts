import { Command } from "@colyseus/command";
import type { Card } from "@dobon-uno/shared";
import type { CardEffectContext } from "../effects";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";
import {
  calculatePlayableCardsForCurrentTurn,
  calculatePlayableCardsForCutIn,
} from "../utils/playableCards";
import {
  advanceToNextPlayer,
  canDobon,
  getPlayersSortedBySeat,
} from "../utils/playerActions";
import { ChooseColorCommand } from "./ChooseColorCommand";
import { DrawCardCommand } from "./DrawCardCommand";
import { DrawStackCommand } from "./DrawStackCommand";
import { PassCommand } from "./PassCommand";

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

    // タイマー開始
    this.startCurrentPlayerTimer();
  }

  /**
   * 現在の手番プレイヤーのタイマーを開始する
   */
  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      this.handleTimeout(currentPlayerId);
    });
  }

  /**
   * タイムアウト時の自動処理
   */
  private handleTimeout(playerId: string): void {
    // 状態に応じた自動処理をdispatch
    if (this.state.waitingForColorChoice) {
      // ランダムに色を選択
      const colors = ["red", "blue", "green", "yellow"] as const;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.room.dispatcher.dispatch(new ChooseColorCommand(), {
        sessionId: playerId,
        color: randomColor,
      });
    } else if (this.state.drawStack > 0) {
      // 累積分を引く
      this.room.dispatcher.dispatch(new DrawStackCommand(), {
        sessionId: playerId,
      });
    } else if (this.state.hasDrawnThisTurn) {
      // パス
      this.room.dispatcher.dispatch(new PassCommand(), {
        sessionId: playerId,
      });
    } else {
      // 1枚引いてパス
      this.room.dispatcher.dispatch(new DrawCardCommand(), {
        sessionId: playerId,
      });
    }
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
      getPlayersSortedBySeat: () => getPlayersSortedBySeat(this.state),
      advanceToNextPlayer: () => advanceToNextPlayer(this.state),
    };
  }

  /**
   * 全プレイヤーのアクション可否を更新する
   */
  private updatePlayerActions() {
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (!fieldCard) return;

    // 最初のカードがワイルドの場合、すべてのカードを出せる
    const isFirstCardWild =
      this.state.fieldCards.length === 1 && fieldCard.value === "wild";

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
        calculatePlayableCardsForCurrentTurn(this.state, player, fieldCard, {
          isFirstCardWild,
        });

        // ドボン判定（手番プレイヤーもドボン可能）
        player.canDobon = canDobon(player, fieldCard);
      } else {
        // 手番でないプレイヤー
        player.canDraw = false;
        player.canDrawStack = false;
        player.canChooseColor = false;
        player.canPass = false;
        player.canDobonReturn = false;

        // カットイン用の出せるカードを計算
        calculatePlayableCardsForCutIn(player, fieldCard);

        // ドボン判定
        player.canDobon = canDobon(player, fieldCard);
      }
    }
  }
}
