import { Command } from "@colyseus/command";
import type { Card, PlayCardAnimationEvent } from "@dobon-uno/shared";
import { CardEffectRegistry } from "../effects";
import type { GameRoom } from "../rooms/GameRoom";
import { CardEffectContextFactory } from "../services/CardEffectContextFactory";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import { advanceToNextPlayer, isSymbolCard } from "../utils/playerActions";
import { NormalFinishCommand } from "./NormalFinishCommand";

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
      if (!this.validateStackCards(player, cardIds, firstCard)) return;
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

    // カードを出したのでフラグをリセット
    player.hasDrawnCard = false;

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

    // ドボンターゲットをリセット（カードを出した人がドボンされる対象）
    this.state.dobonTargetId = sessionId;
    this.state.dobonPlayerIds.splice(0, this.state.dobonPlayerIds.length);

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
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({
      cardPlayerId: sessionId,
      totalPlayedPoints,
    });

    // タイマー開始
    this.startCurrentPlayerTimer();

    // CPUプレイヤーのターンをチェック（色選択待ちの場合も含む）
    this.room.checkCPUTurn();
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
   * @param player カードを出すプレイヤー（カットイン時は非手番プレイヤー）
   * @param cardIds 出すカードのID配列
   * @param firstCard 最初のカード
   */
  private validateStackCards(
    player: { myHand: Card[] },
    cardIds: string[],
    firstCard: Card,
  ): boolean {
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
   * カード効果を適用する
   * @param card 最後に出されたカード（効果適用用）
   * @param stackCount 重ね出し枚数
   * @param firstCard 最初に出されたカード（強制色変えの色決定用）
   */
  private applyCardEffect(card: Card, stackCount: number, firstCard: Card) {
    const effect = CardEffectRegistry.getEffectForCard(card);
    const contextFactory = new CardEffectContextFactory(this.state);
    const context = contextFactory.create(card);

    // ゲーム中のカード効果を適用（Skip: スキップ、Reverse: 方向反転）
    effect.applyOnPlay(context);

    // ドロー累積の処理（単発・重ね出し両対応）
    if (card.value === "draw2") {
      this.state.drawStack += 2 * stackCount;
    } else if (card.value === "draw4") {
      this.state.drawStack += 4 * stackCount;
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
    } else {
      // ドボン可能なプレイヤーがいる場合
      // CPUプレイヤーのドボンをチェック
      this.room.checkCPUTurn();
    }
  }

  /**
   * 現在の手番プレイヤーのタイマーを開始する
   */
  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;
    const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      timeoutHandler.handle(currentPlayerId);
    });
  }
}
