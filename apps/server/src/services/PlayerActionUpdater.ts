import type { Card, GameState, Player } from "@dobon-uno/shared";
import {
  calculatePlayableCardsForCurrentTurn,
  calculatePlayableCardsForCutIn,
} from "../utils/playableCards";
import { canDobon } from "../utils/playerActions";

/**
 * プレイヤーアクション更新のオプション
 */
export interface UpdatePlayerActionsOptions {
  /** 最初のカードがワイルドかどうか（BeginPlayCommand用） */
  isFirstCardWild?: boolean;
  /** カードを出したプレイヤーID（自分が出したカードへのドボン不可） */
  cardPlayerId?: string;
  /** 出されたカードの合計点数（重ね出し時のドボン判定用） */
  totalPlayedPoints?: number;
}

/**
 * プレイヤーのアクション可否を更新するサービス
 */
export class PlayerActionUpdater {
  constructor(private readonly state: GameState) {}

  /**
   * 全プレイヤーのアクション可否を更新する
   */
  update(options: UpdatePlayerActionsOptions = {}): void {
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (!fieldCard) return;

    const {
      isFirstCardWild = false,
      cardPlayerId,
      totalPlayedPoints,
    } = options;

    for (const [sessionId, player] of this.state.players.entries()) {
      const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;

      if (isCurrentTurn) {
        this.updateCurrentTurnPlayer(player, fieldCard, isFirstCardWild);
      } else {
        this.updateNonCurrentTurnPlayer(
          sessionId,
          player,
          fieldCard,
          cardPlayerId,
        );
      }

      // ドボン判定
      this.updateDobonStatus(
        sessionId,
        player,
        fieldCard,
        cardPlayerId,
        totalPlayedPoints,
      );
    }
  }

  /**
   * 手番プレイヤーのアクション可否を更新
   */
  private updateCurrentTurnPlayer(
    player: Player,
    fieldCard: Card,
    isFirstCardWild: boolean,
  ): void {
    player.canDraw =
      !this.state.waitingForColorChoice &&
      this.state.drawStack === 0 &&
      !this.state.hasDrawnThisTurn;
    player.canDrawStack =
      this.state.drawStack > 0 && !this.state.waitingForColorChoice;
    player.canChooseColor = this.state.waitingForColorChoice;
    player.canPass = this.state.hasDrawnThisTurn;
    player.canDobonReturn = false;

    calculatePlayableCardsForCurrentTurn(this.state, player, fieldCard, {
      isFirstCardWild,
    });
  }

  /**
   * 非手番プレイヤーのアクション可否を更新
   */
  private updateNonCurrentTurnPlayer(
    sessionId: string,
    player: Player,
    fieldCard: Card,
    cardPlayerId?: string,
  ): void {
    player.canDraw = false;
    player.canDrawStack = false;
    player.canChooseColor = false;
    player.canPass = false;
    player.canDobonReturn = false;

    // 自分が出したカードに対してはカットイン不可
    if (cardPlayerId && sessionId === cardPlayerId) {
      player.playableCards.clear();
      return;
    }

    // 誰かがカードを引いた後はカットイン不可（ドロースタック消化後など）
    if (player.drewCardSinceLastPlay) {
      player.playableCards.clear();
      return;
    }

    calculatePlayableCardsForCutIn(player, fieldCard);
  }

  /**
   * ドボン可否を更新
   */
  private updateDobonStatus(
    sessionId: string,
    player: Player,
    fieldCard: Card,
    cardPlayerId?: string,
    totalPlayedPoints?: number,
  ): void {
    // 自分が出したカードに対してはドボン不可
    if (cardPlayerId && sessionId === cardPlayerId) {
      player.canDobon = false;
      return;
    }

    // カードを引いた後、まだ誰もカードを出していない場合はドボン不可
    if (player.drewCardSinceLastPlay) {
      player.canDobon = false;
      return;
    }

    // 合計点数が指定されている場合（カードが出された後）
    if (totalPlayedPoints !== undefined) {
      const handTotal = player.myHand.reduce(
        (sum, card) => sum + card.points,
        0,
      );
      player.canDobon = handTotal === totalPlayedPoints;
    } else {
      // ゲーム開始時は場のカードでドボン判定
      player.canDobon = canDobon(player, fieldCard);
    }
  }
}
