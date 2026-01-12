import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
}

/**
 * 累積カードを引くCommand
 */
export class DrawStackCommand extends Command<GameRoom, Payload> {
  execute({ sessionId }: Payload) {
    // TODO: 実装
    console.log(`[DrawStackCommand] Player ${sessionId} drew stack cards`);
  }
}
