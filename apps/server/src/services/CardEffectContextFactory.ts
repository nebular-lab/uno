import type { Card, GameState } from "@dobon-uno/shared";
import type { CardEffectContext } from "../effects";
import {
  advanceToNextPlayer,
  getPlayersSortedBySeat,
} from "../utils/playerActions";

/**
 * カード効果コンテキストを作成するファクトリ
 */
export class CardEffectContextFactory {
  constructor(private readonly state: GameState) {}

  /**
   * カード効果コンテキストを作成する
   */
  create(card: Card): CardEffectContext {
    return {
      state: this.state,
      card,
      getPlayersSortedBySeat: () => getPlayersSortedBySeat(this.state),
      advanceToNextPlayer: () => advanceToNextPlayer(this.state),
    };
  }
}
