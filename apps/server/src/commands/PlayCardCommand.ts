import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
  cardIds: string[]; // 複数カード対応（重ね出し）
}

export class PlayCardCommand extends Command<GameRoom, Payload> {
  validate() {
    return true;
  }
  execute() {}
}
