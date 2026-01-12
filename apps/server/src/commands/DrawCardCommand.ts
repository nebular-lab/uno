import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
}

/**
 * 山札からカードを引くCommand
 */
export class DrawCardCommand extends Command<GameRoom, Payload> {
  execute({ sessionId }: Payload) {
    // TODO: 実装
    console.log(`[DrawCardCommand] Player ${sessionId} drew a card`);
  }
}
