import { Command } from "@colyseus/command";
import type { Card } from "@dobon-uno/shared";
import { TIMING } from "../config/timing";
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
      // 最初のカードの特殊効果を適用
      this.handleFirstCardEffect(firstCard);
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
   * 最初のカードの特殊効果を適用する
   */
  private handleFirstCardEffect(card: Card) {
    switch (card.value) {
      case "skip":
        // スキップ: 最初のプレイヤーがスキップされる
        this.advanceToNextPlayer();
        break;
      case "reverse":
        // リバース: 順番が逆になる（最初のプレイヤーは変わらない）
        this.state.turnDirection = -1;
        break;
      case "draw2":
        // ドロー2: 累積ドロー枚数を2に設定
        this.state.drawStack = 2;
        break;
      case "wild":
        // ワイルド: 色選択待ち（BeginPlayCommandで設定）
        break;
      case "draw4":
        // ドロー4: 累積ドロー枚数を4に設定、色選択待ち
        this.state.drawStack = 4;
        break;
      case "force-change":
        // 強制色変え: カードの色で自動設定済み
        break;
      default:
        // 数字カード: 何もしない
        break;
    }
  }

  /**
   * 次のプレイヤーに手番を進める（スキップ時に使用）
   */
  private advanceToNextPlayer() {
    const sortedBySeat = Array.from(this.state.players.values()).sort(
      (a, b) => a.seatId - b.seatId,
    );
    const currentIndex = sortedBySeat.findIndex(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    const direction = this.state.turnDirection;
    const nextIndex =
      (currentIndex + direction + sortedBySeat.length) % sortedBySeat.length;
    this.state.currentTurnPlayerId = sortedBySeat[nextIndex].sessionId;
  }
}
