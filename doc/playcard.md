# PlayCardCommand フロントエンド実装設計書

## 概要

カードを出すアクションのフロントエンド実装。アニメーションを含めた設計を行う。

## 現状の問題点

### GameScreen.tsx のバグ

`apps/client/src/screens/GameScreen.tsx:66` で `playCard` の呼び出しが間違っている：

```typescript
// 現在（バグ）
playCard(selectedCardIds[0], selectedCardIds.length);

// 正しい呼び出し
playCard(selectedCardIds);
```

`useGameRoom.ts` の `playCard` は `(cardIds: string[]) => void` であるため、配列を渡す必要がある。

## アーキテクチャ

### アニメーションフローの課題

現在の状態同期（`onStateChange`）では、サーバーの状態変更が即座にクライアントに反映される。
これだと以下の問題がある：

1. カードを出した瞬間に手札から消え、場札に表示される
2. アニメーションの再生時間がない
3. 誰がカードを出したか視覚的にわからない

### 解決策：アニメーションイベント方式

```
[クライアントA] playCard送信
       ↓
[サーバー] PlayCardCommand実行
       ↓
[サーバー] アニメーションイベント送信（全クライアント）
       ↓ （state変更はまだ）
[全クライアント] アニメーション開始
       ↓ （アニメーション再生）
[サーバー] state更新（少し遅延させる or クライアント側で待つ）
       ↓
[全クライアント] アニメーション完了、通常表示に切り替え
```

## 詳細設計

### 1. サーバー側：アニメーションイベント

#### 新規メッセージタイプ

```typescript
// packages/shared/src/events.ts

export interface PlayCardAnimationEvent {
  type: "playCardAnimation";
  playerId: string; // カードを出したプレイヤーのsessionId
  seatId: number; // プレイヤーの座席番号（1-6）
  cards: {
    id: string;
    color: string;
    value: string;
    points: number;
  }[]; // 出されたカード（複数枚対応）
  isCurrentTurn: boolean; // 手番プレイヤーかどうか（カットインの場合false）
  animationDuration: number; // アニメーション時間（ms）
}
```

#### PlayCardCommand の修正

```typescript
// apps/server/src/commands/PlayCardCommand.ts

execute({ sessionId, cardIds }: Payload) {
  // ... カード処理 ...

  // アニメーションイベントを送信
  this.room.broadcast("playCardAnimation", {
    type: "playCardAnimation",
    playerId: sessionId,
    seatId: player.seatId,
    cards: playedCards.map(c => ({
      id: c.id,
      color: c.color,
      value: c.value,
      points: c.points,
    })),
    isCurrentTurn,
    animationDuration: 500, // 500ms
  });

  // state更新は通常通り（onStateChangeで同期される）
  // ※クライアント側でアニメーション中は更新を遅延表示する
}
```

### 2. クライアント側：アニメーション管理

#### アニメーション状態Atom

```typescript
// apps/client/src/atoms/animationAtoms.ts

import { atom } from "jotai";

export interface CardAnimation {
  id: string; // アニメーションID（ユニーク）
  type: "playCard";
  playerId: string;
  seatId: number;
  cards: ClientCard[];
  isSelf: boolean; // 自分が出したカードかどうか
  startTime: number;
  duration: number;
  phase: "moving" | "settling" | "done";
}

// 現在再生中のアニメーション
export const currentAnimationAtom = atom<CardAnimation | null>(null);

// アニメーション中かどうか
export const isAnimatingAtom = atom(
  (get) => get(currentAnimationAtom) !== null,
);
```

#### アニメーションイベントハンドラ

```typescript
// apps/client/src/atoms/connectionAtoms.ts の setupRoomStateSync 内

// アニメーションイベントを購読
room.onMessage("playCardAnimation", (event: PlayCardAnimationEvent) => {
  const isSelf = event.playerId === room.sessionId;

  const animation: CardAnimation = {
    id: `play-${Date.now()}`,
    type: "playCard",
    playerId: event.playerId,
    seatId: event.seatId,
    cards: event.cards,
    isSelf,
    startTime: Date.now(),
    duration: event.animationDuration,
    phase: "moving",
  };

  set(currentAnimationAtom, animation);

  // アニメーション完了後にクリア
  setTimeout(() => {
    set(currentAnimationAtom, null);
  }, event.animationDuration);
});
```

### 3. アニメーションコンポーネント

#### CardPlayAnimation コンポーネント

```typescript
// apps/client/src/components/game/CardPlayAnimation.tsx

import { motion, AnimatePresence } from "motion/react";
import { useAtomValue } from "jotai";
import { currentAnimationAtom } from "@/atoms/animationAtoms";
import { Card } from "./Card";

// 座席位置の座標（ピクセル）
const seatCoordinates: Record<number, { x: number; y: number }> = {
  1: { x: 625, y: 24 },    // 上中央
  2: { x: 1062, y: 120 },  // 右上
  3: { x: 1062, y: 280 },  // 右下
  4: { x: 625, y: 368 },   // 下中央
  5: { x: 187, y: 280 },   // 左下
  6: { x: 187, y: 120 },   // 左上
};

// 場札の位置
const fieldPosition = { x: 625, y: 200 };

export const CardPlayAnimation = () => {
  const animation = useAtomValue(currentAnimationAtom);

  if (!animation || animation.type !== "playCard") return null;

  const startPos = animation.isSelf
    ? { x: 625, y: 500 }  // 自分の手札位置（下部中央）
    : seatCoordinates[animation.seatId] || fieldPosition;

  // カードサイズの調整（手札と場札でサイズが異なる）
  const startScale = animation.isSelf ? 1.0 : 0.7;
  const endScale = 1.0;  // 場札サイズ

  return (
    <AnimatePresence>
      <div className="pointer-events-none absolute inset-0 z-50">
        {animation.cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{
              x: startPos.x,
              y: startPos.y,
              scale: startScale,
              opacity: 0,
              rotateZ: index * 5,  // 重ね出し時の回転
            }}
            animate={{
              x: fieldPosition.x + index * 3,  // 少しずらして重ねる
              y: fieldPosition.y,
              scale: endScale,
              opacity: 1,
              rotateZ: index * 3,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: animation.duration / 1000,
              ease: "easeOut",
              delay: index * 0.05,  // 重ね出し時の時差
            }}
            className="absolute"
            style={{ originX: 0.5, originY: 0.5 }}
          >
            <Card card={card} size="field" />
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
};
```

### 4. GameScreen への統合

```typescript
// apps/client/src/screens/GameScreen.tsx

import { CardPlayAnimation } from "@/components/game/CardPlayAnimation";
import { useAtomValue } from "jotai";
import { isAnimatingAtom } from "@/atoms/animationAtoms";

export const GameScreen = () => {
  const isAnimating = useAtomValue(isAnimatingAtom);

  // ... existing code ...

  return (
    <TableContainer>
      {/* ... existing elements ... */}

      {/* 場のカード - アニメーション中は非表示にするオプション */}
      {(phase === "revealing" || phase === "playing") &&
        fieldCards.length > 0 && !isAnimating && (
          <div className="absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
            <FieldCard card={fieldCards[0]} />
          </div>
        )}

      {/* カード出しアニメーション */}
      <CardPlayAnimation />

      {/* ... rest of elements ... */}
    </TableContainer>
  );
};
```

### 5. 自分のカードを出す場合の特別処理

自分がカードを出す場合、選択したカードの位置からアニメーションを開始する必要がある。

#### 選択カードの位置を追跡

```typescript
// apps/client/src/atoms/cardPositionAtom.ts

import { atom } from "jotai";

// 手札カードの画面上の位置を記録
export const cardPositionsAtom = atom<Record<string, { x: number; y: number }>>(
  {},
);

// 位置を更新するアクション
export const setCardPositionAtom = atom(
  null,
  (get, set, { cardId, x, y }: { cardId: string; x: number; y: number }) => {
    const current = get(cardPositionsAtom);
    set(cardPositionsAtom, { ...current, [cardId]: { x, y } });
  },
);
```

#### MyHand での位置報告

```typescript
// apps/client/src/components/game/MyHand.tsx

import { useSetAtom } from "jotai";
import { setCardPositionAtom } from "@/atoms/cardPositionAtom";
import { useRef, useEffect } from "react";

const CardWrapper = ({ card, children }: { card: ClientCard; children: React.ReactNode }) => {
  const setCardPosition = useSetAtom(setCardPositionAtom);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCardPosition({
        cardId: card.id,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, [card.id, setCardPosition]);

  return <div ref={ref}>{children}</div>;
};
```

### 6. 他プレイヤーのカードを出す場合のアニメーション

他プレイヤーがカードを出した場合：

1. プレイヤーシート付近にカードが表示される（表向き）
2. カードが場札位置に移動する

```typescript
// CardPlayAnimation.tsx の他プレイヤー用ロジック

// 他プレイヤーの場合：シート位置から開始
const startPos = seatCoordinates[animation.seatId];

// まず表示してから移動
<motion.div
  initial={{
    x: startPos.x,
    y: startPos.y,
    scale: 0.3,  // 小さく表示
    opacity: 0,
  }}
  animate={{
    x: fieldPosition.x,
    y: fieldPosition.y,
    scale: 1.0,
    opacity: 1,
  }}
  transition={{
    duration: animation.duration / 1000,
    ease: [0.34, 1.56, 0.64, 1],  // カスタムイージング（弾むような動き）
  }}
>
```

## 実装順序

1. **Phase 1: バグ修正**
   - GameScreen.tsx の playCard 呼び出し修正

2. **Phase 2: サーバー側**
   - `PlayCardAnimationEvent` 型定義
   - PlayCardCommand でアニメーションイベントを送信

3. **Phase 3: クライアント基盤**
   - `animationAtoms.ts` 作成
   - `connectionAtoms.ts` でアニメーションイベントをハンドル

4. **Phase 4: アニメーションコンポーネント**
   - `CardPlayAnimation.tsx` 作成
   - GameScreen への統合

5. **Phase 5: 位置追跡（自分のカード用）**
   - `cardPositionAtom.ts` 作成
   - MyHand での位置報告

6. **Phase 6: 調整**
   - アニメーション時間の調整
   - イージングの調整
   - 重ね出し時の表示調整

## カードサイズの対応

| 用途     | 幅   | 高さ  | 使用箇所             |
| -------- | ---- | ----- | -------------------- |
| 場札     | 56px | 80px  | FieldCard            |
| 手札     | 78px | 108px | MyHand/Card          |
| シート用 | 40px | 56px  | アニメーション開始時 |

アニメーション中にスケールで調整：

- 自分のカード: 1.0 → 0.72 (78px → 56px)
- 他プレイヤー: 0.52 → 0.72 (40px → 56px)

## 注意事項

1. **アニメーション中の状態同期**
   - Colyseus の `onStateChange` は通常通り動作
   - アニメーション中は表示を遅延させる（currentAnimationAtom をチェック）

2. **高速連続プレイ**
   - アニメーションキューを設ける（現在は1つのみ）
   - 前のアニメーションが終わる前に次が来た場合は即座に完了させる

3. **切断・再接続**
   - 再接続時はアニメーションをスキップ
   - 現在の状態を即座に表示

4. **パフォーマンス**
   - `will-change: transform` を活用
   - 複数カードの同時アニメーションでも60fps維持
