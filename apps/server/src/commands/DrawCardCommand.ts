import { Command } from "@colyseus/command";
import type { DrawCardAnimationEvent } from "@dobon-uno/shared";
import type { GameRoom } from "../rooms/GameRoom";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import { DeckOutCommand } from "./DeckOutCommand";

interface Payload {
  sessionId: string;
}

const DRAW_ANIMATION_DURATION = 1000;

/**
 * 山札からカードを引くCommand
 */
export class DrawCardCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    if (this.state.phase !== "playing") return false;

    const player = this.state.players.get(sessionId);
    if (!player) return false;

    return player.canDraw;
  }

  execute({ sessionId }: Payload) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    // タイマー停止
    this.room.turnTimerService.stopTimer(sessionId);

    // 山札から1枚引く
    const drawnCard = this.room.deck.pop();
    if (!drawnCard) {
      this.handleDeckOut();
      return;
    }

    // 手札に追加
    player.myHand.push(drawnCard);
    player.handCount = player.myHand.length;
    this.state.deckCount = this.room.deck.length;

    // ドローアニメーションイベントを送信
    const animationEvent: DrawCardAnimationEvent = {
      type: "drawCardAnimation",
      playerId: sessionId,
      seatId: player.seatId,
      cardCount: 1,
      animationDuration: DRAW_ANIMATION_DURATION,
    };
    this.room.broadcast("drawCardAnimation", animationEvent);

    // 状態更新
    this.state.hasDrawnThisTurn = true;
    player.hasDrawnCard = true;

    // 誰かがカードを引いたら全員ドボン不可にする
    for (const p of this.state.players.values()) {
      p.drewCardSinceLastPlay = true;
    }

    // 山札が0枚になった場合 → ゲーム終了
    if (this.room.deck.length === 0) {
      this.handleDeckOut();
      return;
    }

    // 全プレイヤーのアクション可否を更新
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

    // タイマー再開
    this.startCurrentPlayerTimer();

    // CPUプレイヤーのターンをチェック
    this.room.checkCPUTurn();
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
