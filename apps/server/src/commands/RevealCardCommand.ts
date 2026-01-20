import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

/**
 * 場札を公開するCommand
 * TODO: Step 5で詳細実装
 */
export class RevealCardCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "revealing";

    // TODO: Step 5で以下を実装
    // - fieldCardsにfirstCardを追加
    // - currentColorを設定
    // - 最初のカードの特殊効果を適用
    // - BeginPlayCommandへ移行
  }
}
