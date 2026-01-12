import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
  color: string;
}

export class ChooseColorCommand extends Command<GameRoom, Payload> {
  execute({ sessionId, color }: Payload) {
    // TODO: 実装
    console.log(`[ChooseColorCommand] Player ${sessionId} chose ${color}`);
  }
}
