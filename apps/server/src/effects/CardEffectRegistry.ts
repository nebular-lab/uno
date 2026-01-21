import type { Card } from "@dobon-uno/shared";
import type { CardEffect } from "./CardEffect";
import {
  Draw2Effect,
  Draw4Effect,
  ForceChangeEffect,
  NumberEffect,
  ReverseEffect,
  SkipEffect,
  WildEffect,
} from "./effects";

/**
 * カード効果のレジストリ
 * カードのvalueから適切な効果インスタンスを取得する
 *
 * 新しいカードタイプを追加する場合:
 * 1. effects.ts に新しい効果クラスを追加
 * 2. このファイルの effectMap に登録
 */
class CardEffectRegistryClass {
  /** 効果インスタンスのマップ（シングルトン） */
  private readonly effectMap: Map<string, CardEffect>;

  /** 数字カード用のデフォルト効果 */
  private readonly defaultEffect: CardEffect;

  constructor() {
    this.defaultEffect = new NumberEffect();

    this.effectMap = new Map<string, CardEffect>([
      // 記号カード
      ["skip", new SkipEffect()],
      ["reverse", new ReverseEffect()],
      ["draw2", new Draw2Effect()],

      // ワイルドカード
      ["wild", new WildEffect()],
      ["draw4", new Draw4Effect()],

      // 強制色変えカード
      ["force-change", new ForceChangeEffect()],
    ]);
  }

  /**
   * カードのvalueから効果を取得する
   * 登録されていないvalue（数字カード）の場合はデフォルト効果を返す
   */
  getEffect(cardValue: string): CardEffect {
    return this.effectMap.get(cardValue) ?? this.defaultEffect;
  }

  /**
   * カードから効果を取得する（便利メソッド）
   */
  getEffectForCard(card: Card): CardEffect {
    return this.getEffect(card.value);
  }

  /**
   * 新しい効果を登録する（拡張用）
   */
  registerEffect(cardValue: string, effect: CardEffect): void {
    this.effectMap.set(cardValue, effect);
  }
}

/** カード効果レジストリのシングルトンインスタンス */
export const CardEffectRegistry = new CardEffectRegistryClass();
