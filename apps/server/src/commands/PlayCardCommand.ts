import { Command } from "@colyseus/command";
import type { Card, PlayCardAnimationEvent } from "@dobon-uno/shared";
import type { CardEffectContext } from "../effects";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";
import {
  calculatePlayableCardsForCurrentTurn,
  calculatePlayableCardsForCutIn,
} from "../utils/playableCards";
import {
  advanceToNextPlayer,
  getPlayersSortedBySeat,
  isSymbolCard,
} from "../utils/playerActions";
import { ChooseColorCommand } from "./ChooseColorCommand";
import { DrawCardCommand } from "./DrawCardCommand";
import { DrawStackCommand } from "./DrawStackCommand";
import { NormalFinishCommand } from "./NormalFinishCommand";
import { PassCommand } from "./PassCommand";

interface Payload {
  sessionId: string;
  cardIds: string[]; // 複数カード対応（重ね出し）
}

/**
 * プレイヤーがカードを出すCommand
 */
export class PlayCardCommand extends Command<GameRoom, Payload> {
  validate({ sessionId, cardIds }: Payload): boolean {
    // フェーズチェック
    if (this.state.phase !== "playing") return false;

    // プレイヤー存在チェック
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // カードIDチェック
    if (cardIds.length === 0) return false;

    // 最初のカードがplayableCardsに含まれているかチェック
    if (!player.playableCards.get(cardIds[0])) return false;

    // 重ね出しで記号カード上がりをしていないかチェック
    if (cardIds.length > 1) {
      const firstCard = player.myHand.find((c) => c.id === cardIds[0]);
      const willFinish = player.myHand.length === cardIds.length;
      if (willFinish && firstCard && isSymbolCard(firstCard)) {
        return false;
      }
    }

    return true;
  }

  execute({ sessionId, cardIds }: Payload) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;
    const firstCard = player.myHand.find((c) => c.id === cardIds[0]);
    if (!firstCard) return;

    // 重ね出し検証
    if (cardIds.length > 1) {
      if (!this.validateStackCards(cardIds, firstCard)) return;
    }

    // タイマー停止
    this.room.turnTimerService.stopTimer(this.state.currentTurnPlayerId);

    // 手札からカードを削除し、場に追加
    const playedCards: Card[] = [];
    for (const cardId of cardIds) {
      const cardIndex = player.myHand.findIndex((c) => c.id === cardId);
      if (cardIndex !== -1) {
        const [card] = player.myHand.splice(cardIndex, 1);
        playedCards.push(card);
        this.state.fieldCards.push(card);
      }
    }
    player.handCount = player.myHand.length;

    // 重ね出し表示用に出したカード枚数を記録
    this.state.lastPlayedCount = playedCards.length;

    // アニメーションイベントを送信
    this.broadcastPlayCardAnimation(
      sessionId,
      player.seatId,
      playedCards,
      isCurrentTurn,
    );

    // カットインの場合、手番を変更
    if (!isCurrentTurn) {
      this.state.currentTurnPlayerId = sessionId;
    }

    // カード効果を適用
    // 強制色変えの重ね出しでは最初のカードの色を使うため、firstCardも渡す
    const lastPlayedCard = playedCards[playedCards.length - 1];
    this.applyCardEffect(lastPlayedCard, playedCards.length, firstCard);

    // 上がり判定
    if (player.handCount === 0) {
      this.handleFinish(sessionId, playedCards);
      return;
    }

    // 色選択待ちの場合は手番を移さない（カードを出したプレイヤーが色を選択する）
    if (!this.state.waitingForColorChoice) {
      // 次のプレイヤーに手番を移す
      advanceToNextPlayer(this.state);
    }

    // ドローフラグをリセット
    this.state.hasDrawnThisTurn = false;

    // 出されたカードの合計点数を計算
    const totalPlayedPoints = playedCards.reduce(
      (sum, card) => sum + card.points,
      0,
    );

    // 全プレイヤーのアクション可否を更新（カードを出したプレイヤーはドボン不可）
    this.updatePlayerActions(totalPlayedPoints, sessionId);

    // タイマー開始
    this.startCurrentPlayerTimer();
  }

  /**
   * カード出しアニメーションイベントを送信
   */
  private broadcastPlayCardAnimation(
    playerId: string,
    seatId: number,
    cards: Card[],
    isCurrentTurn: boolean,
  ): void {
    const event: PlayCardAnimationEvent = {
      type: "playCardAnimation",
      playerId,
      seatId,
      cards: cards.map((c) => ({
        id: c.id,
        color: c.color,
        value: c.value,
        points: c.points,
      })),
      isCurrentTurn,
      animationDuration: 500,
    };
    this.room.broadcast("playCardAnimation", event);
  }

  /**
   * 重ね出しのカード検証
   */
  private validateStackCards(cardIds: string[], firstCard: Card): boolean {
    const player = this.state.players.get(this.state.currentTurnPlayerId);
    if (!player) return false;

    for (let i = 1; i < cardIds.length; i++) {
      const card = player.myHand.find((c) => c.id === cardIds[i]);
      if (!card) return false;

      if (firstCard.value === "force-change") {
        // 強制色変えは色が違っても重ね出し可能
        if (card.value !== "force-change") return false;
      } else {
        // それ以外は同色・同数字のみ
        if (card.color !== firstCard.color || card.value !== firstCard.value) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 全プレイヤーのアクション可否を更新する
   * @param totalPlayedPoints 出されたカードの合計点数（ドボン判定用）
   * @param cardPlayerId カードを出したプレイヤーのID（自分が出したカードにはドボン不可）
   */
  private updatePlayerActions(totalPlayedPoints: number, cardPlayerId: string) {
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (!fieldCard) return;

    for (const [sessionId, player] of this.state.players.entries()) {
      const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;

      if (isCurrentTurn) {
        // 手番プレイヤーのアクション設定
        calculatePlayableCardsForCurrentTurn(this.state, player, fieldCard, {
          isFirstCardWild: false,
        });
        player.canDraw =
          !this.state.waitingForColorChoice && this.state.drawStack === 0;
        player.canDrawStack = this.state.drawStack > 0;
        player.canChooseColor = this.state.waitingForColorChoice;
        player.canPass = this.state.hasDrawnThisTurn;
      } else {
        // 手番でないプレイヤー
        calculatePlayableCardsForCutIn(player, fieldCard);
        player.canDraw = false;
        player.canDrawStack = false;
        player.canChooseColor = false;
        player.canPass = false;
      }

      // ドボン判定（重ね出しの場合は合計点数で判定）
      // 自分が出したカードに対してはドボン不可
      if (sessionId === cardPlayerId) {
        player.canDobon = false;
      } else {
        const handTotal = player.myHand.reduce(
          (sum, card) => sum + card.points,
          0,
        );
        player.canDobon = handTotal === totalPlayedPoints;
      }
      player.canDobonReturn = false;
    }
  }

  /**
   * カード効果を適用する
   * @param card 最後に出されたカード（効果適用用）
   * @param stackCount 重ね出し枚数
   * @param firstCard 最初に出されたカード（強制色変えの色決定用）
   */
  private applyCardEffect(card: Card, stackCount: number, firstCard: Card) {
    const effect = CardEffectRegistry.getEffectForCard(card);
    const context = this.createEffectContext(card);

    effect.applyOnReveal(context);

    // 重ね出し時のドロー累積
    if (stackCount > 1) {
      if (card.value === "draw2") {
        this.state.drawStack = 2 * stackCount;
      } else if (card.value === "draw4") {
        this.state.drawStack = 4 * stackCount;
      }
    }

    // 色の更新（強制色変えの重ね出しでは最初のカードの色を使用）
    const colorCard = card.value === "force-change" ? firstCard : card;
    if (colorCard.color !== "wild") {
      this.state.currentColor = colorCard.color;
      this.state.waitingForColorChoice = false;
    } else if (card.value === "wild" || card.value === "draw4") {
      this.state.waitingForColorChoice = true;
    }
  }

  /**
   * 効果コンテキストを作成する
   */
  private createEffectContext(card: Card): CardEffectContext {
    return {
      state: this.state,
      card,
      getPlayersSortedBySeat: () => getPlayersSortedBySeat(this.state),
      advanceToNextPlayer: () => advanceToNextPlayer(this.state),
    };
  }

  /**
   * 上がり処理
   */
  private handleFinish(finishingPlayerId: string, playedCards: Card[]) {
    // 出したカードの合計点数を計算
    const totalPoints = playedCards.reduce((sum, card) => sum + card.points, 0);

    // 全プレイヤーのアクションをリセット
    let anyoneCanDobon = false;
    for (const [sessionId, player] of this.state.players.entries()) {
      // playableCardsをクリア（カットイン不可）
      player.playableCards.clear();

      // 上がったプレイヤー以外のドボン判定
      if (sessionId !== finishingPlayerId) {
        const handTotal = player.myHand.reduce(
          (sum, card) => sum + card.points,
          0,
        );
        player.canDobon = handTotal === totalPoints;
        if (player.canDobon) anyoneCanDobon = true;
      } else {
        player.canDobon = false;
      }

      // その他のアクションを無効化
      player.canDraw = false;
      player.canDrawStack = false;
      player.canChooseColor = false;
      player.canPass = false;
      player.canDobonReturn = false;
    }

    // 誰もドボンできない場合は即座に上がり確定
    if (!anyoneCanDobon) {
      this.room.dispatcher.dispatch(new NormalFinishCommand(), {
        sessionId: finishingPlayerId,
      });
    }
    // ドボン可能なプレイヤーがいる場合はタイマーで待機（別途実装）
  }

  /**
   * 現在の手番プレイヤーのタイマーを開始する
   */
  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      this.handleTimeout(currentPlayerId);
    });
  }

  /**
   * タイムアウト時の自動処理
   */
  private handleTimeout(playerId: string): void {
    if (this.state.waitingForColorChoice) {
      // ランダムに色を選択
      const colors = ["red", "blue", "green", "yellow"] as const;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.room.dispatcher.dispatch(new ChooseColorCommand(), {
        sessionId: playerId,
        color: randomColor,
      });
    } else if (this.state.drawStack > 0) {
      // 累積分を引く
      this.room.dispatcher.dispatch(new DrawStackCommand(), {
        sessionId: playerId,
      });
    } else if (this.state.hasDrawnThisTurn) {
      // パス
      this.room.dispatcher.dispatch(new PassCommand(), {
        sessionId: playerId,
      });
    } else {
      // 1枚引いてパス
      this.room.dispatcher.dispatch(new DrawCardCommand(), {
        sessionId: playerId,
      });
    }
  }
}
