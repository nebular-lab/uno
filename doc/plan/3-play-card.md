# PlayCardCommand 実装計画

プレイヤーが手札からカードを出すコマンドの実装。

**参照ドキュメント:**
- `doc/spec/game-rule.md` - カードを出す条件、重ね出し、上がり制限、カットイン

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成（メッセージ例: `Step N: 〇〇を追加`）
4. 作業を停止し、次のステップは別のセッションで実行

---

## Step 1: 共通ユーティリティのテスト作成（playerActions） ✅

**新規ファイル:** `apps/server/src/utils/playerActions.test.ts`

テストケース:
- `isSymbolCard`: 記号カード判定
- `canDobon`: ドボン判定
- `advanceToNextPlayer`: 次のプレイヤーへの手番移動
- `getPlayersSortedBySeat`: 座席順ソート

---

## Step 2: 共通ユーティリティの実装（playerActions） ✅

**新規ファイル:** `apps/server/src/utils/playerActions.ts`

```typescript
import type { Card, GameState, Player } from "@dobon-uno/shared";

export function advanceToNextPlayer(state: GameState): void {
  const sortedBySeat = getPlayersSortedBySeat(state);
  const currentIndex = sortedBySeat.findIndex(
    (p) => p.sessionId === state.currentTurnPlayerId,
  );
  const direction = state.turnDirection;
  const nextIndex =
    (currentIndex + direction + sortedBySeat.length) % sortedBySeat.length;
  state.currentTurnPlayerId = sortedBySeat[nextIndex].sessionId;
}

export function getPlayersSortedBySeat(state: GameState): Player[] {
  return Array.from(state.players.values()).sort(
    (a, b) => a.seatId - b.seatId,
  );
}

export function isSymbolCard(card: Card): boolean {
  const symbolValues = ["skip", "reverse", "draw2", "wild", "draw4", "force-change"];
  return symbolValues.includes(card.value);
}

export function canDobon(player: Player, fieldCard: Card): boolean {
  let handTotal = 0;
  for (const card of player.myHand) {
    handTotal += card.points;
  }
  return handTotal === fieldCard.points;
}
```

Step 1のテストがパスすることを確認。

**→ コミットして作業を止める**

---

## Step 3: 共通ユーティリティのテスト作成（playableCards） ✅

**新規ファイル:** `apps/server/src/utils/playableCards.test.ts`

テストケース:
- `calculatePlayableCardsForCurrentTurn`: 通常の判定、上がり制限（手札1枚で記号カード）
- `calculatePlayableCardsForCutIn`: カットイン判定

---

## Step 4: 共通ユーティリティの実装（playableCards） ✅

**新規ファイル:** `apps/server/src/utils/playableCards.ts`

密結合を避けるため、手番プレイヤー用とカットイン用で関数を分離する。

```typescript
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
  context: { isFirstCardWild: boolean }
): void {
  player.playableCards.clear();

  if (state.waitingForColorChoice && state.drawStack === 0) {
    return;
  }

  for (const card of player.myHand) {
    // 上がり制限: 手札1枚で記号カードは出せない
    if (player.myHand.length === 1 && isSymbolCard(card)) {
      continue;
    }

    if (context.isFirstCardWild) {
      player.playableCards.set(card.id, true);
    } else {
      const effect = CardEffectRegistry.getEffectForCard(card);
      if (state.drawStack > 0) {
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
  fieldCard: Card
): void {
  player.playableCards.clear();

  for (const card of player.myHand) {
    const effect = CardEffectRegistry.getEffectForCard(card);
    if (effect.canCutIn(card, fieldCard)) {
      player.playableCards.set(card.id, true);
    }
  }
}
```

Step 3のテストがパスすることを確認。

**→ コミットして作業を止める**

---

## Step 5: BeginPlayCommand のリファクタリング ✅

**変更ファイル:** `apps/server/src/commands/BeginPlayCommand.ts`

共通ユーティリティを使用するように変更:

```typescript
import { advanceToNextPlayer, getPlayersSortedBySeat, canDobon } from "../utils/playerActions";
import { calculatePlayableCardsForCurrentTurn, calculatePlayableCardsForCutIn } from "../utils/playableCards";

// updatePlayerActions() 内で使用
const isFirstCardWild =
  this.state.fieldCards.length === 1 && fieldCard.value === "wild";

if (isCurrentTurn) {
  calculatePlayableCardsForCurrentTurn(this.state, player, fieldCard, { isFirstCardWild });
} else {
  calculatePlayableCardsForCutIn(player, fieldCard);
}
```

既存テスト（`BeginPlayCommand.test.ts`）がパスすることを確認。

**→ コミットして作業を止める**

---

## Step 6: フロントエンドの修正 ✅

**変更ファイル:** `apps/client/src/hooks/useGameRoom.ts`

```typescript
const playCard = useCallback(
  (cardIds: string[]) => {
    if (gameRoomState.status !== "connected") return;
    gameRoomState.room.send("playCard", cardIds);
  },
  [gameRoomState],
);
```

**変更ファイル:** `apps/client/src/components/game/MyHand.tsx`

```typescript
if (stackableCards.length === 1) {
  playCard([cardId]);
  setSelectedCardIds([]);
}
```

**→ コミットして作業を止める**

---

## Step 7: PlayCardCommand のテスト作成 ✅

**新規ファイル:** `apps/server/src/commands/PlayCardCommand.test.ts`

テストケース:

1. **バリデーション**
   - playing以外のフェーズは拒否
   - playableCardsに含まれていないカードは拒否
   - 重ね出しで記号カード上がりは拒否

2. **実行**
   - カードが手札から場に移動する
   - handCountが正しく更新される
   - 次のプレイヤーに手番が移る

3. **カード種別ごと**
   - 数字カード
   - スキップ、リバース、ドロー2
   - ワイルド、ドロー4、強制色変え

4. **特殊ケース**
   - カットイン
   - 重ね出し（同色・同数字）
   - 重ね出し（強制色変え - 異なる色同士）

---

## Step 8: PlayCardCommand の validate() 実装

**変更ファイル:** `apps/server/src/commands/PlayCardCommand.ts`

```typescript
validate({ sessionId, cardIds }: Payload): boolean {
  if (this.state.phase !== "playing") return false;

  const player = this.state.players.get(sessionId);
  if (!player) return false;

  if (cardIds.length === 0) return false;

  if (!player.playableCards.get(cardIds[0])) return false;

  // 重ね出しで記号カード上がりをしていないかチェック
  if (cardIds.length > 1) {
    const firstCard = player.myHand.find(c => c.id === cardIds[0]);
    const willFinish = player.myHand.length === cardIds.length;
    if (willFinish && firstCard && isSymbolCard(firstCard)) {
      return false;
    }
  }

  return true;
}
```

Step 7のバリデーションテストがパスすることを確認。

**→ コミットして作業を止める**

---

## Step 9: PlayCardCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/PlayCardCommand.ts`

```typescript
execute({ sessionId, cardIds }: Payload) {
  const player = this.state.players.get(sessionId)!;
  const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;
  const firstCard = player.myHand.find(c => c.id === cardIds[0])!;

  // 重ね出し検証
  if (cardIds.length > 1) {
    if (!this.validateStackCards(player, cardIds, firstCard)) return;
  }

  // タイマー停止
  this.room.turnTimerService.stopTimer(this.state.currentTurnPlayerId);

  // 手札からカードを削除し、場に追加
  const playedCards: Card[] = [];
  for (const cardId of cardIds) {
    const cardIndex = player.myHand.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      const [card] = player.myHand.splice(cardIndex, 1);
      playedCards.push(card);
      this.state.fieldCards.push(card);
    }
  }
  player.handCount = player.myHand.length;

  // カットインの場合、手番を変更
  if (!isCurrentTurn) {
    this.state.currentTurnPlayerId = sessionId;
  }

  // カード効果を適用
  const lastPlayedCard = playedCards[playedCards.length - 1];
  this.applyCardEffect(lastPlayedCard, playedCards.length);

  // 上がり判定
  if (player.handCount === 0) {
    this.handleFinish(sessionId);
    return;
  }

  // 次のプレイヤーに手番を移す
  advanceToNextPlayer(this.state);

  // 全プレイヤーのアクション可否を更新
  this.updatePlayerActions();

  // タイマー開始
  this.startCurrentPlayerTimer();
}
```

Step 7の実行テストがパスすることを確認。

**→ コミットして作業を止める**

---

## Step 10: PlayCardCommand のヘルパーメソッド実装

**変更ファイル:** `apps/server/src/commands/PlayCardCommand.ts`

```typescript
private validateStackCards(player: Player, cardIds: string[], firstCard: Card): boolean {
  for (let i = 1; i < cardIds.length; i++) {
    const card = player.myHand.find(c => c.id === cardIds[i]);
    if (!card) return false;

    if (firstCard.value === "force-change") {
      if (card.value !== "force-change") return false;
    } else {
      if (card.color !== firstCard.color || card.value !== firstCard.value) {
        return false;
      }
    }
  }
  return true;
}

private updatePlayerActions() {
  const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];

  for (const [sessionId, player] of this.state.players.entries()) {
    const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;

    if (isCurrentTurn) {
      calculatePlayableCardsForCurrentTurn(
        this.state, player, fieldCard, { isFirstCardWild: false }
      );
    } else {
      calculatePlayableCardsForCutIn(player, fieldCard);
    }

    // canDraw, canDrawStack, canDobon等の設定...
  }
}

private applyCardEffect(card: Card, stackCount: number) {
  const effect = CardEffectRegistry.getEffectForCard(card);
  const context = this.createEffectContext(card);

  effect.applyOnReveal(context);

  if (stackCount > 1) {
    if (card.value === "draw2") {
      this.state.drawStack = 2 * stackCount;
    } else if (card.value === "draw4") {
      this.state.drawStack = 4 * stackCount;
    }
  }

  if (card.color !== "wild") {
    this.state.currentColor = card.color;
    this.state.waitingForColorChoice = false;
  } else if (card.value === "wild" || card.value === "draw4") {
    this.state.waitingForColorChoice = true;
  }
}
```

Step 7の全テストがパスすることを確認。

**→ コミットして作業を止める（実装完了）**

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/server/src/utils/playerActions.test.ts` | 新規作成 |
| `apps/server/src/utils/playerActions.ts` | 新規作成 |
| `apps/server/src/utils/playableCards.test.ts` | 新規作成 |
| `apps/server/src/utils/playableCards.ts` | 新規作成 |
| `apps/server/src/commands/BeginPlayCommand.ts` | リファクタリング |
| `apps/server/src/commands/PlayCardCommand.test.ts` | 新規作成 |
| `apps/server/src/commands/PlayCardCommand.ts` | 実装 |
| `apps/client/src/hooks/useGameRoom.ts` | playCard関数の引数変更 |
| `apps/client/src/components/game/MyHand.tsx` | playCard呼び出し変更 |
