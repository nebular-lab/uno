import { Command } from "@colyseus/command";
import { GameResult } from "@dobon-uno/shared";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string; // 上がったプレイヤーのID
}

/** 上がり表示時間（ミリ秒） */
const FINISH_DISPLAY_DURATION = 3000;
/** スコアパネル表示時間（ミリ秒） */
const SCORE_DISPLAY_DURATION = 5000;
/** 結果表示合計時間（ミリ秒） */
const RESULT_DISPLAY_DURATION =
  FINISH_DISPLAY_DURATION + SCORE_DISPLAY_DURATION;

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
    const gameResult = new GameResult();
    gameResult.gameNumber = this.state.gameHistory.length + 1;
    gameResult.winnerId = sessionId;
    gameResult.finishType = "normal";
    gameResult.timestamp = Date.now();

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
      gameResult.scoreChanges.set(playerId, -loss);

      totalWinnings += loss;
    }

    // 勝者に得点を加算
    const winner = this.state.players.get(sessionId);
    if (winner) {
      winner.score += totalWinnings;
      gameResult.scoreChanges.set(sessionId, totalWinnings);
    }

    // 3. GameResultをgameHistoryに追加
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
