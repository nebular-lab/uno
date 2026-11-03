import type { Card, GameState, Player } from "@dobon-uno/shared";
import { CardEffectRegistry } from "../effects";
import { isSymbolCard } from "./playerActions";

/**
 * 手番プレイヤー用: 出せるカードを計算
 */
export function calculatePlayableCardsForCurrentTurn(
  state: GameState,
  player: Player,
  fieldCard: Card,
  context: { isFirstCardWild: boolean },
): void {
  player.playableCards.clear();

  // 色選択待ち中は出せない
  if (state.waitingForColorChoice) {
    return;
  }

  for (const card of player.myHand) {
    // 上がり制限: 手札1枚で記号カードは出せない
    if (player.myHand.length === 1 && isSymbolCard(card)) {
      continue;
    }

    if (context.isFirstCardWild) {
      // 最初のカードがワイルドなら全カード出せる
      player.playableCards.set(card.id, true);
    } else {
      const effect = CardEffectRegistry.getEffectForCard(card);
      if (state.drawStack > 0) {
        // ドロー累積中はドローカードのみ
        if (effect.canPlayOnDrawStack(card, fieldCard)) {
          player.playableCards.set(card.id, true);
        }
      } else if (effect.canPlay(card, fieldCard, state.currentColor)) {
        player.playableCards.set(card.id, true);
      }
    }
  }
}

/**
 * 非手番プレイヤー用: カットイン可能なカードを計算
 */
export function calculatePlayableCardsForCutIn(
  player: Player,
  fieldCard: Card,
): void {
  player.playableCards.clear();

  for (const card of player.myHand) {
    const effect = CardEffectRegistry.getEffectForCard(card);
    if (effect.canCutIn(card, fieldCard)) {
      player.playableCards.set(card.id, true);
    }
  }
}
