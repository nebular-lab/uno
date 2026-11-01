import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { createGameResult, RESULT_DISPLAY_DURATION } from "../utils/finishGame";
import { getPlayersSortedBySeat } from "../utils/playerActions";

/**
 * 山札切れ（流局）でゲームを終了するCommand
 *
 * DrawCardCommand、DrawStackCommandから、山札が0枚になった時点で呼び出される。
 *
 * 処理内容:
 * 1. 全タイマーを停止し、全プレイヤーのアクションを無効化
 * 2. フェーズを"result"に変更（手札は公開しない）
 * 3. 全員の得点変動を0としてGameResultをgameHistoryに追加
 * 4. 次のゲームの最初のプレイヤーを「次の手番だったプレイヤー」に設定
 * 5. 連続山札切れ回数を増やし、次のゲームのレートを2^n倍にする
 * 6. 一定時間後にwaitingフェーズに戻る
 */
export class DeckOutCommand extends Command<GameRoom> {
  execute() {
    // 1. 全タイマーを停止
    this.room.turnTimerService.stopAllTimers();

    // 全プレイヤーのアクションを無効化
    for (const player of this.state.players.values()) {
      player.playableCards.clear();
      player.canDraw = false;
      player.canDrawStack = false;
      player.canChooseColor = false;
      player.canPass = false;
      player.canDobon = false;
      player.canDobonReturn = false;
    }

    // 累積ドローの途中で山札が切れた場合も、残りの累積は引かせない
    this.state.drawStack = 0;

    // 2. フェーズを結果に変更
    this.state.phase = "result";

    // 3. 点数のやり取りはないので、全員0として結果を残す
    const scoreChanges = new Map<string, number>();
    for (const playerId of this.state.players.keys()) {
      scoreChanges.set(playerId, 0);
    }
    const gameResult = createGameResult(
      this.state,
      "",
      "deckOut",
      scoreChanges,
    );
    this.state.gameHistory.push(gameResult);

    // 4. 山札がなくなった時点での次の手番のプレイヤーから始める
    this.state.nextGameStartPlayerId = this.getNextTurnPlayerId();

    // 5. 次のゲームのレートを倍増
    this.state.consecutiveDeckouts += 1;
    this.state.rateMultiplier = 2 ** this.state.consecutiveDeckouts;

    // 6. 一定時間後にwaitingフェーズに戻る
    this.clock.setTimeout(() => {
      this.room.resetGameState();
      this.state.phase = "waiting";
    }, RESULT_DISPLAY_DURATION);
  }

  /**
   * 山札を引いた手番のプレイヤーの、次の手番のプレイヤーを返す
   */
  private getNextTurnPlayerId(): string {
    const sortedBySeat = getPlayersSortedBySeat(this.state);
    const currentIndex = sortedBySeat.findIndex(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    if (currentIndex === -1) return "";
    const nextIndex =
      (currentIndex + this.state.turnDirection + sortedBySeat.length) %
      sortedBySeat.length;
    return sortedBySeat[nextIndex].sessionId;
  }
}
