# アクションボタンUI追加計画

## 概要

画面右端にアクションボタン群を追加する。左端のソート＆合計表示と対称的な配置。

## 追加するボタン

| ボタン | 表示条件 | 色 | 機能 |
|--------|----------|-----|------|
| 重ね出し枚数 | 複数ある同じカードを選択時 | `bg-black/50` | 1〜N枚を選択（同じカードを何枚出すか） |
| 山札を引く | `canDraw` | `bg-black/50` | 山札から1枚引く |
| ドロースタックを引く | `canDrawStack` | `bg-red-500/80` | 累積カードを引く |
| 色選択（4色） | `canChooseColor` | 各色 | ワイルドカード後の色指定 |
| ドボン | `canDobon` | `bg-purple-500/80` | ドボン宣言 |
| ドボン返し | `canDobonReturn` | `bg-orange-500/80` | ドボン返し宣言 |

## 配置

```
左端 (left-4)                              右端 (right-4)
┌──────────┐                              ┌──────────┐
│ ソート   │                              │ 1枚     │ ← カード選択時のみ
└──────────┘                              └──────────┘
┌──────────┐                              ┌──────────┐
│ 合計     │                              │ 2枚     │ ← 重ね出し選択
│   15     │                              └──────────┘
└──────────┘                              ┌──────────┐
                                          │ 引く     │ ← 条件付き
                                          └──────────┘
                                          ┌──────────┐
                                          │ ドボン   │ ← 条件付き
                                          └──────────┘
                                              ...
```

- 位置: `fixed bottom-[150px] right-4`
- サイズ: 78×78px
- 縦並び: `flex flex-col gap-2`

## 重ね出し機能の動作

1. 手札のカードをタップ/クリック
2. そのカードと同じカード（同色・同数字）が手札に複数ある場合、右端に枚数選択ボタンを表示
   - 例: 赤5を2枚持っている場合 → 「1枚」「2枚」ボタンを表示
3. 枚数を選択してカードを出す

## 実装ステップ

### Step 1: ClientPlayer型にアクションフラグを追加

**ファイル**: `apps/client/src/types/connection.ts`

```typescript
export type ClientPlayer = {
  // 既存フィールド...
  // 追加
  canPass: boolean;
  canDraw: boolean;
  canChooseColor: boolean;
  canDobon: boolean;
  canDobonReturn: boolean;
  canDrawStack: boolean;
};
```

### Step 2: connectionAtoms.tsでアクションフラグを同期

**ファイル**: `apps/client/src/atoms/connectionAtoms.ts`

`convertPlayer`関数にアクションフラグを追加:

```typescript
const convertPlayer = (serverPlayer: ServerPlayer): ClientPlayer => ({
  // 既存...
  canPass: serverPlayer.canPass,
  canDraw: serverPlayer.canDraw,
  canChooseColor: serverPlayer.canChooseColor,
  canDobon: serverPlayer.canDobon,
  canDobonReturn: serverPlayer.canDobonReturn,
  canDrawStack: serverPlayer.canDrawStack,
});
```

### Step 3: useGameRoomにアクション関数を追加

**ファイル**: `apps/client/src/hooks/useGameRoom.ts`

```typescript
// 自分のプレイヤー情報を取得
const myPlayer = mySeatIndex >= 0 ? gamePlayState.players[mySeatIndex] : null;

// アクション関数
const drawCard = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("drawCard");
}, [gameRoomState]);

const drawStack = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("drawStack");
}, [gameRoomState]);

const dobon = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("dobon");
}, [gameRoomState]);

const dobonReturn = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("dobonReturn");
}, [gameRoomState]);

const chooseColor = useCallback((color: string) => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("chooseColor", color);
}, [gameRoomState]);

return {
  // 既存...
  // アクションフラグ
  canDraw: myPlayer?.canDraw ?? false,
  canDrawStack: myPlayer?.canDrawStack ?? false,
  canChooseColor: myPlayer?.canChooseColor ?? false,
  canDobon: myPlayer?.canDobon ?? false,
  canDobonReturn: myPlayer?.canDobonReturn ?? false,
  // アクション関数
  drawCard,
  drawStack,
  dobon,
  dobonReturn,
  chooseColor,
};
```

### Step 4: 選択カード状態の管理用atomを作成

**新規ファイル**: `apps/client/src/atoms/selectedCardAtom.ts`

```typescript
import { atom } from "jotai";

// 選択中のカードID（null = 未選択）
export const selectedCardIdAtom = atom<string | null>(null);
```

### Step 5: ActionButtonsコンポーネントを作成

**新規ファイル**: `apps/client/src/components/game/ActionButtons.tsx`

- 重ね出し枚数ボタン（選択カードと同じカードが複数ある場合のみ表示）
- 各アクションボタン（条件付き表示）
- 色選択は2x2グリッドで表示

### Step 6: Card/MyHandコンポーネントで選択状態を管理

**ファイル**: `apps/client/src/components/game/Card.tsx`, `MyHand.tsx`

- カードクリック時に選択状態を更新
- 選択中のカードはハイライト表示

### Step 7: GameScreenに組み込み

**ファイル**: `apps/client/src/screens/GameScreen.tsx`

`phase === "playing"` の時に `<ActionButtons />` を表示

## 修正対象ファイル

1. `apps/client/src/types/connection.ts` - 型定義追加
2. `apps/client/src/atoms/connectionAtoms.ts` - 同期処理追加
3. `apps/client/src/hooks/useGameRoom.ts` - アクション関数追加
4. `apps/client/src/atoms/selectedCardAtom.ts` - 新規作成（選択カード状態）
5. `apps/client/src/components/game/ActionButtons.tsx` - 新規作成
6. `apps/client/src/components/game/Card.tsx` - 選択状態対応
7. `apps/client/src/components/game/MyHand.tsx` - 選択ハンドリング追加
8. `apps/client/src/screens/GameScreen.tsx` - コンポーネント組み込み

## 検証方法

1. `pnpm check` - Biomeチェック
2. `pnpm typecheck` - 型チェック
3. ブラウザで確認:
   - 重ね出し枚数ボタンが常に右端に表示されること
   - playingフェーズで各アクションボタンが条件に応じて表示されること
   - ボタンクリックでサーバーにメッセージが送信されること（DevToolsで確認）

## 注意事項

- サーバー側のコマンド（DrawCardCommand等）はTODO状態のため、ボタンを押しても実際の処理は行われない
- UIの実装を先行し、サーバー側実装後に動作確認を行う
