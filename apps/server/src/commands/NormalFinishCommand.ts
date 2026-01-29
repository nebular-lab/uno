import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

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

  execute(_payload: Payload) {
    // TODO: 実装
  }
}
