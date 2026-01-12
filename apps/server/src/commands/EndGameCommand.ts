import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  winnerId: string;
}

/**
 * ゲームを終了するCommand
 * 得点計算、スコア履歴への記録、次ゲームの準備
 */
export class EndGameCommand extends Command<GameRoom, Payload> {
  execute({ winnerId }: Payload) {
    // TODO: 実装
    console.log(`[EndGameCommand] Game ended, winner: ${winnerId}`);
  }
}
