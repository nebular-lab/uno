import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

/**
 * 山札切れでゲームを終了するCommand
 */
export class DeckOutCommand extends Command<GameRoom> {
  execute() {
    // 全タイマーを停止
    this.room.turnTimerService.stopAllTimers();

    // 全プレイヤーのアクションを無効化
    for (const player of this.state.players.values()) {
      player.playableCards.clear();
      player.canDraw = false;
      player.canDrawStack = false;
      player.canChooseColor = false;
      player.canPass = false;
      player.canDobon = false;
      player.canDobonReturn = false;
    }

    // フェーズを結果に変更
    this.state.phase = "result";
  }
}
