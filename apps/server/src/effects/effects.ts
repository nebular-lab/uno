import type { Card } from "@dobon-uno/shared";
import { BaseCardEffect, type CardEffectContext } from "./CardEffect";

/**
 * 数字カードの効果
 * 特殊効果なし、色または数字一致で出せる
 */
export class NumberEffect extends BaseCardEffect {
  // すべてBaseCardEffectのデフォルト実装を使用
}

/**
 * スキップカードの効果
 * 最初の場札として公開された場合、最初のプレイヤーがスキップされる
 */
export class SkipEffect extends BaseCardEffect {
  applyOnReveal(context: CardEffectContext): void {
    context.advanceToNextPlayer();
  }
}

/**
 * リバースカードの効果
 * 最初の場札として公開された場合、順番が逆になる
 */
export class ReverseEffect extends BaseCardEffect {
  applyOnReveal(context: CardEffectContext): void {
    context.state.turnDirection = -1;
  }
}

/**
 * ドロー2カードの効果
 * 最初の場札として公開された場合、累積ドロー枚数を2に設定
 * ドロー累積中はdraw2またはdraw4を重ねられる
 */
export class Draw2Effect extends BaseCardEffect {
  applyOnReveal(context: CardEffectContext): void {
    context.state.drawStack = 2;
  }

  canPlayOnDrawStack(card: Card, fieldCard: Card): boolean {
    // draw2にはdraw2またはdraw4を重ねられる
    if (fieldCard.value === "draw2") {
      return card.value === "draw2" || card.value === "draw4";
    }
    return false;
  }
}

/**
 * ワイルドカードの効果
 * 常に出せる、色選択が必要（ただし最初の場札の場合は出した人が色を決める）
 */
export class WildEffect extends BaseCardEffect {
  canPlay(_card: Card, _fieldCard: Card, _currentColor: string): boolean {
    // ワイルドは常に出せる
    return true;
  }

  canCutIn(card: Card, fieldCard: Card): boolean {
    // ワイルド同士でカットイン可能（同じvalue）
    if (card.color === "wild" && fieldCard.color === "wild") {
      return card.value === fieldCard.value;
    }
    return false;
  }
}

/**
 * ドロー4カードの効果
 * 常に出せる、累積ドロー枚数を4に設定、色選択が必要
 * ドロー累積中はdraw4のみ重ねられる
 */
export class Draw4Effect extends BaseCardEffect {
  applyOnReveal(context: CardEffectContext): void {
    context.state.drawStack = 4;
  }

  applyOnBeginPlay(context: CardEffectContext): void {
    // ドロー4が最初の場札の場合、色選択状態にする
    context.state.waitingForColorChoice = true;
  }

  canPlay(_card: Card, _fieldCard: Card, _currentColor: string): boolean {
    // ドロー4は常に出せる
    return true;
  }

  canPlayOnDrawStack(card: Card, fieldCard: Card): boolean {
    // draw4にはdraw4のみ重ねられる
    if (fieldCard.value === "draw4") {
      return card.value === "draw4";
    }
    // draw2にはdraw4を重ねられる
    if (fieldCard.value === "draw2") {
      return card.value === "draw4";
    }
    return false;
  }

  canCutIn(card: Card, fieldCard: Card): boolean {
    // ドロー4同士でカットイン可能
    if (card.color === "wild" && fieldCard.color === "wild") {
      return card.value === fieldCard.value;
    }
    return false;
  }
}

/**
 * 強制色変えカードの効果
 * 常に出せる、カードの色で強制的に色が変わる
 */
export class ForceChangeEffect extends BaseCardEffect {
  canPlay(_card: Card, _fieldCard: Card, _currentColor: string): boolean {
    // 強制色変えは常に出せる
    return true;
  }

  canCutIn(card: Card, fieldCard: Card): boolean {
    // 強制色変え同士でカットイン可能
    return card.value === "force-change" && fieldCard.value === "force-change";
  }
}
