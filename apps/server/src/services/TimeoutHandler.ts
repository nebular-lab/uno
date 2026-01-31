import type { Dispatcher } from "@colyseus/command";
import type { GameState } from "@dobon-uno/shared";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
import type { GameRoom } from "../rooms/GameRoom";

/**
 * タイムアウト時の自動処理を担当するハンドラー
 */
export class TimeoutHandler {
  constructor(
    private readonly state: GameState,
    private readonly dispatcher: Dispatcher<GameRoom>,
  ) {}

  /**
   * タイムアウト時の自動処理を実行する
   */
  handle(playerId: string): void {
    if (this.state.waitingForColorChoice) {
      // ランダムに色を選択
      const colors = ["red", "blue", "green", "yellow"] as const;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.dispatcher.dispatch(new ChooseColorCommand(), {
        sessionId: playerId,
        color: randomColor,
      });
    } else if (this.state.drawStack > 0) {
      // 累積分を引く
      this.dispatcher.dispatch(new DrawStackCommand(), {
        sessionId: playerId,
      });
    } else if (this.state.hasDrawnThisTurn) {
      // パス
      this.dispatcher.dispatch(new PassCommand(), {
        sessionId: playerId,
      });
    } else {
      // 1枚引いてパス
      this.dispatcher.dispatch(new DrawCardCommand(), {
        sessionId: playerId,
      });
    }
  }
}
