import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
}

/**
 * ドボン返しを宣言するCommand
 */
export class DobonReturnCommand extends Command<GameRoom, Payload> {
  execute({ sessionId }: Payload) {
    // TODO: 実装
    console.log(
      `[DobonReturnCommand] Player ${sessionId} declared dobon return`,
    );
  }
}
