import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
}

/**
 * ドボンを宣言するCommand
 */
export class DobonCommand extends Command<GameRoom, Payload> {
  execute({ sessionId }: Payload) {
    // TODO: 実装
    console.log(`[DobonCommand] Player ${sessionId} declared dobon`);
  }
}
