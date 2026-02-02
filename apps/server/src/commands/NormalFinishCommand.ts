import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { createGameResult, RESULT_DISPLAY_DURATION } from "../utils/finishGame";

interface Payload {
  sessionId: string; // 上がったプレイヤーのID
}

/**
 * 普通の上がりでゲームが終了した時のコマンド
 *
 * PlayCardCommandから呼び出される。
 * ドボンやドボン返しではない、通常の上がり（手札を出し切った）場合に使用。
 *
 * 処理内容:
 * 1. フェーズを"result"に変更
 * 2. 収支計算（各プレイヤーが上がった人に手札の合計点数を支払う）
 * 3. GameResultを作成してgameHistoryに追加
 * 4. 次のゲームの最初のプレイヤーを設定
 * 5. レート倍率をリセット（consecutiveDeckoutsも0に）
 * 6. 一定時間後にwaitingフェーズに戻る
 */
export class NormalFinishCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    // フェーズチェック
    if (this.state.phase !== "playing") return false;

    // プレイヤーの存在チェック
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // 手札が0枚であることを確認
    if (player.handCount !== 0) return false;

    return true;
  }

  execute({ sessionId }: Payload) {
    // 1. フェーズを"result"に変更
    this.state.phase = "result";

    // 2. 収支計算
    const rateMultiplier = this.state.rateMultiplier;
    const scoreChanges = new Map<string, number>();
    let totalWinnings = 0;

    for (const [playerId, player] of this.state.players.entries()) {
      if (playerId === sessionId) {
        continue; // 勝者は後で設定
      }

      // 各プレイヤーの手札合計点数を計算
      const handTotal = player.myHand.reduce(
        (sum, card) => sum + card.points,
        0,
      );
      const loss = handTotal * rateMultiplier;

      // 点数を引く
      player.score -= loss;
      scoreChanges.set(playerId, -loss);

      totalWinnings += loss;
    }

    // 勝者に得点を加算
    const winner = this.state.players.get(sessionId);
    if (winner) {
      winner.score += totalWinnings;
      scoreChanges.set(sessionId, totalWinnings);
    }

    // 3. GameResultを作成してgameHistoryに追加
    const gameResult = createGameResult(
      this.state,
      sessionId,
      "normal",
      scoreChanges,
    );
    this.state.gameHistory.push(gameResult);

    // 4. 次のゲームの最初のプレイヤーを設定
    this.state.nextGameStartPlayerId = sessionId;

    // 5. レート倍率をリセット
    this.state.rateMultiplier = 1;
    this.state.consecutiveDeckouts = 0;

    // 6. 一定時間後にwaitingフェーズに戻る
    this.clock.setTimeout(() => {
      this.room.resetGameState();
      this.state.phase = "waiting";
    }, RESULT_DISPLAY_DURATION);
  }
}
