import { Command } from "@colyseus/command";
import { TIMING } from "../config/timing";
import type { GameRoom } from "../rooms/GameRoom";
import { CountdownCommand } from "./CountdownCommand";

interface Payload {
  sessionId: string;
  startPlayerId?: string;
  rateMultiplier?: number;
}

/**
 * ゲームを開始するCommand
 * 山札生成、カード配布、最初のプレイヤー決定
 */
export class StartGameCommand extends Command<GameRoom, Payload> {
  validate(payload: Payload): boolean {
    // waiting状態か
    if (this.state.phase !== "waiting") return false;

    // オーナーか
    const player = this.state.players.get(payload.sessionId);
    if (!player?.isOwner) return false;

    // 3人以上か
    if (this.state.players.size < 3) return false;

    return true;
  }

  execute(payload: Payload) {
    // 1. フェーズを "dealing" に変更
    this.state.phase = "dealing";

    // 2. 山札を生成（DeckProvider経由）
    this.room.deck = this.room.createDeck();

    // 3. 最初のプレイヤーを決定してハイライト
    this.state.currentTurnPlayerId = this.determineFirstPlayer(
      payload.startPlayerId,
    );

    // 4. 全プレイヤーに7枚ずつ一気に配布
    this.dealAllCards();

    // 5. 最初の場札を決定
    const firstCard = this.room.deck.pop();
    if (firstCard) {
      this.state.firstCard = firstCard;
    }
    this.state.deckCount = this.room.deck.length;
    this.state.dealingRound = 7; // 配布完了を示す

    // 6. カウントダウンフェーズへ移行
    this.room.clock.setTimeout(() => {
      this.room.dispatcher.dispatch(new CountdownCommand());
    }, TIMING.DEAL_COMPLETE_DELAY);
  }

  private determineFirstPlayer(startPlayerId?: string): string {
    // nextGameStartPlayerIdが設定されていればそれを使う
    if (startPlayerId && this.state.players.has(startPlayerId)) {
      return startPlayerId;
    }
    // なければホスト（オーナー）から始める
    for (const player of this.state.players.values()) {
      if (player.isOwner) {
        return player.sessionId;
      }
    }
    // フォールバック（通常は到達しない）
    return this.state.players.keys().next().value ?? "";
  }

  private dealAllCards() {
    // 各プレイヤーに7枚ずつ配布
    for (let i = 0; i < 7; i++) {
      for (const player of this.state.players.values()) {
        const card = this.room.deck.pop();
        if (card) {
          player.myHand.push(card);
          player.handCount++;
        }
      }
    }
    this.state.deckCount = this.room.deck.length;
  }
}
