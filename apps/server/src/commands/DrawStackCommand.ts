import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import { advanceToNextPlayer } from "../utils/playerActions";
import { DeckOutCommand } from "./DeckOutCommand";

interface Payload {
  sessionId: string;
}

/**
 * 累積カードを引くCommand
 */
export class DrawStackCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    return player.canDrawStack;
  }

  execute({ sessionId }: Payload) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    // タイマー停止
    this.room.turnTimerService.stopTimer(sessionId);

    // 累積枚数を取得
    const drawCount = this.state.drawStack;

    // 累積枚数分のカードを引く
    for (let i = 0; i < drawCount; i++) {
      const drawnCard = this.room.deck.pop();
      if (!drawnCard) {
        // 途中で山札切れ → 引いた分だけカウント更新してゲーム終了
        player.handCount = player.myHand.length;
        this.state.deckCount = this.room.deck.length;
        this.handleDeckOut();
        return;
      }

      // 手札に追加
      player.myHand.push(drawnCard);
    }

    // カウント更新
    player.handCount = player.myHand.length;
    this.state.deckCount = this.room.deck.length;

    // 累積リセット
    this.state.drawStack = 0;

    // 山札が0枚になった場合 → ゲーム終了
    if (this.room.deck.length === 0) {
      this.handleDeckOut();
      return;
    }

    // 次のプレイヤーに手番を移す
    advanceToNextPlayer(this.state);

    // 全プレイヤーのアクション可否を更新
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update();

    // タイマー再開（次のプレイヤー）
    this.startCurrentPlayerTimer();
  }

  private handleDeckOut(): void {
    this.room.dispatcher.dispatch(new DeckOutCommand(), {});
  }

  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;
    const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      timeoutHandler.handle(currentPlayerId);
    });
  }
}
