import { Command } from "../command";
import { ResolveDobonWaitCommand } from "./ResolveDobonWaitCommand";

interface Payload {
  sessionId: string;
}

/**
 * ドボンできるプレイヤーが「ドボンしない」を選ぶCommand
 * ドボン待ちのタイムアウト時にも実行される
 */
export class SkipDobonCommand extends Command<Payload> {
  validate({ sessionId }: Payload): boolean {
    if (this.state.phase !== "playing") return false;

    const player = this.state.players.get(sessionId);
    if (!player) return false;

    return player.canDobon;
  }

  execute({ sessionId }: Payload) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    this.room.turnTimerService.stopTimer(sessionId);

    // 同じカードに対しては、あとからドボンできないようにする
    player.canDobon = false;
    player.declinedDobon = true;

    this.room.dispatcher.dispatch(new ResolveDobonWaitCommand());
  }
}
