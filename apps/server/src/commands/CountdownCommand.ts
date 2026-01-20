import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { RevealCardCommand } from "./RevealCardCommand";

/**
 * カウントダウンを行うCommand
 * 3, 2, 1, 0とカウントダウンし、完了後にRevealCardCommandへ移行
 */
export class CountdownCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "countdown";
    this.state.countdown = 3;

    this.tick();
  }

  private tick() {
    if (this.state.countdown > 0) {
      // 1秒後に次のカウント
      this.room.clock.setTimeout(() => {
        this.state.countdown--;
        this.tick();
      }, 1000);
    } else {
      // カウントダウン完了、場札公開フェーズへ
      this.room.dispatcher.dispatch(new RevealCardCommand());
    }
  }
}
