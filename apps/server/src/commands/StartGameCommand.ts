import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  startPlayerId?: string;
  rateMultiplier?: number;
}

/**
 * ゲームを開始するCommand
 * 山札生成、カード配布、最初のプレイヤー決定
 */
export class StartGameCommand extends Command<GameRoom, Payload> {
  execute() {
    // TODO: 実装
    console.log(`[StartGameCommand] Game started`);
  }
}
