import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import { advanceToNextPlayer } from "../utils/playerActions";

interface Payload {
  sessionId: string;
  color: string;
}

const VALID_COLORS = ["red", "blue", "green", "yellow"] as const;

export class ChooseColorCommand extends Command<GameRoom, Payload> {
  validate({ sessionId, color }: Payload): boolean {
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // canChooseColorで手番・フェーズ・色選択待ちをまとめて確認
    if (!player.canChooseColor) return false;

    // 有効な色かチェック
    if (!VALID_COLORS.includes(color as (typeof VALID_COLORS)[number])) {
      return false;
    }

    return true;
  }

  execute({ sessionId, color }: Payload) {
    // タイマー停止
    this.room.turnTimerService.stopTimer(sessionId);

    // 色を設定
    this.state.currentColor = color;
    this.state.waitingForColorChoice = false;

    // 次のプレイヤーに手番を移す
    advanceToNextPlayer(this.state);

    // 全プレイヤーのアクション可否を更新
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    const totalPlayedPoints = fieldCard.points * this.state.lastPlayedCount;

    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({
      cardPlayerId: sessionId,
      totalPlayedPoints,
    });

    // 次のプレイヤーのタイマーを開始
    this.startCurrentPlayerTimer();
  }

  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;
    const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      timeoutHandler.handle(currentPlayerId);
    });
  }
}
