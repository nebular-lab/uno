import type { Card, GameState, Player } from "@dobon-uno/shared";

/**
 * カード効果を適用するためのコンテキスト
 * 効果クラスが状態を操作するために必要な情報を提供
 */
export interface CardEffectContext {
  /** ゲーム状態 */
  state: GameState;
  /** 効果が適用されるカード */
  card: Card;
  /** プレイヤーを座席順でソートして取得 */
  getPlayersSortedBySeat: () => Player[];
  /** 次のプレイヤーに手番を進める */
  advanceToNextPlayer: () => void;
}

/**
 * カード効果のインターフェース
 * 各カードタイプはこのインターフェースを実装する
 */
export interface CardEffect {
  /**
   * ゲーム開始時（最初の場札として公開された時）の効果を適用
   * @param context 効果コンテキスト
   */
  applyOnReveal(context: CardEffectContext): void;

  /**
   * プレイフェーズ開始時の効果を適用
   * 例: ドロー4の場合、色選択状態にする
   * @param context 効果コンテキスト
   */
  applyOnBeginPlay(context: CardEffectContext): void;

  /**
   * このカードが出せるかどうかを判定（通常時）
   * @param card 手札のカード
   * @param fieldCard 場のカード
   * @param currentColor 現在有効な色
   * @returns 出せる場合true
   */
  canPlay(card: Card, fieldCard: Card, currentColor: string): boolean;

  /**
   * ドロー累積中にこのカードを出せるかどうかを判定
   * @param card 手札のカード
   * @param fieldCard 場のカード（draw2またはdraw4）
   * @returns 出せる場合true
   */
  canPlayOnDrawStack(card: Card, fieldCard: Card): boolean;

  /**
   * このカードでカットインできるかどうかを判定
   * @param card 手札のカード
   * @param fieldCard 場のカード
   * @returns カットインできる場合true
   */
  canCutIn(card: Card, fieldCard: Card): boolean;
}

/**
 * カード効果の基底クラス
 * デフォルト実装を提供し、各効果クラスで必要な部分のみオーバーライド
 */
export abstract class BaseCardEffect implements CardEffect {
  applyOnReveal(_context: CardEffectContext): void {
    // デフォルトは何もしない
  }

  applyOnBeginPlay(_context: CardEffectContext): void {
    // デフォルトは何もしない
  }

  canPlay(card: Card, fieldCard: Card, currentColor: string): boolean {
    // デフォルト: 色一致または数字/記号一致
    if (card.color === currentColor) return true;
    if (card.value === fieldCard.value) return true;
    return false;
  }

  canPlayOnDrawStack(_card: Card, _fieldCard: Card): boolean {
    // デフォルト: ドロー累積中は出せない
    return false;
  }

  canCutIn(card: Card, fieldCard: Card): boolean {
    // デフォルト: 色と数字/記号が完全一致
    return card.color === fieldCard.color && card.value === fieldCard.value;
  }
}
