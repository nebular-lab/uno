import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
}

export class PassCommand extends Command<GameRoom, Payload> {
  execute({ sessionId }: Payload) {
    // TODO: 実装
    console.log(`[PassCommand] Player ${sessionId} passed`);
  }
}
