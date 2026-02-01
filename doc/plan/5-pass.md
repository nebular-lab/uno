# PassCommand 実装計画

プレイヤーが山札を引いた後にパスするコマンドの実装。

**参照ドキュメント:**
- `doc/spec/game-rule.md` - セクション8「任意ドロー」、セクション14「タイムアウト処理」
- `doc/spec/screen.md` - セクション3.1「通常アクション」

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成（メッセージ例: `Step N: 〇〇を追加`）
4. 作業を停止し、次のステップは別のセッションで実行

---

## 現在の実装状況

| ファイル | 状態 |
|---------|------|
| `packages/shared/src/action.ts` | ✅ PassAction 型定義済み |
| `apps/server/src/commands/PassCommand.ts` | ❌ TODO実装のみ |
| `apps/server/src/services/PlayerActionUpdater.ts` | ✅ canPass 条件定義済み |
| `apps/server/src/services/TimeoutHandler.ts` | ✅ パス呼び出し済み |
| `apps/client/src/components/game/ActionButtons.tsx` | ❌ パスボタン未実装 |

---

## パス機能の仕様

### パスが使える条件

1. ゲームフェーズが「playing」状態
2. 現在の手番プレイヤーである
3. 山札を1枚以上引いた後（hasDrawnThisTurn === true）
4. ドロー累積中でない（drawStack === 0）
5. 色選択待ち中でない（waitingForColorChoice === false）

### パス実行後の動作

1. タイマーを停止
2. hasDrawnThisTurn を false にリセット
3. 次のプレイヤーに手番を移す
4. 全プレイヤーのアクション状態を更新
5. 次のプレイヤーのタイマーを開始

---

## Step 1: PassCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/PassCommand.test.ts`

テストケース:

1. **バリデーション**
   - playing以外のフェーズではパスできない
   - 存在しないプレイヤーはパスできない
   - 非手番プレイヤーはパスできない
   - hasDrawnThisTurn が false ではパスできない
   - drawStack > 0 ではパスできない
   - waitingForColorChoice が true ではパスできない

2. **実行**
   - パス後、hasDrawnThisTurn が false にリセットされる
   - パス後、次のプレイヤーに手番が移る
   - パス後、手番プレイヤーの canDraw が true になる
   - パス後、前のプレイヤーの canDraw が false になる
   - パス後、全プレイヤーの canPass が false になる

3. **ドボン判定**
   - パス後、各プレイヤーのドボン判定が更新される

---

## Step 2: PassCommand の validate() 実装

**変更ファイル:** `apps/server/src/commands/PassCommand.ts`

`PlayerActionUpdater` で既に `canPass` の条件を計算しているので、validate はシンプルに:

```typescript
validate({ sessionId }: Payload): boolean {
  const player = this.state.players.get(sessionId);
  return player?.canPass ?? false;
}
```

**対応テスト:** バリデーション全項目

**→ コミットして作業を止める**

---

## Step 3: PassCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/PassCommand.ts`

```typescript
execute({ sessionId }: Payload) {
  // タイマー停止
  this.room.turnTimerService.stopTimer(sessionId);

  // ドローフラグをリセット
  this.state.hasDrawnThisTurn = false;

  // 次のプレイヤーに手番を移す
  advanceToNextPlayer(this.state);

  // 全プレイヤーのアクション状態を更新
  this.room.playerActionUpdater.update();

  // 次のプレイヤーのタイマーを開始
  this.room.turnTimerService.startTimer(this.state.currentTurnPlayerId);
}
```

**インポート追加:**
```typescript
import { advanceToNextPlayer } from "../utils/playerActions";
```

**対応テスト:** 実行・ドボン判定全項目

**→ コミットして作業を止める**

---

## Step 4: クライアント - useGameRoom に pass を追加

**変更ファイル:** `apps/client/src/hooks/useGameRoom.ts`

```typescript
// アクション関数に追加
const pass = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("pass");
}, [gameRoomState]);

// 返り値に追加
return {
  // ...既存のプロパティ
  // アクションフラグに追加
  canPass: myPlayerInfo?.canPass ?? false,
  // アクション関数に追加
  pass,
};
```

**→ コミットして作業を止める**

---

## Step 5: クライアント - ActionButtons にパスボタンを追加

**変更ファイル:** `apps/client/src/components/game/ActionButtons.tsx`

ActionButtons は直接 useGameRoom を呼んでいるので、propsの変更は不要。

```typescript
export const ActionButtons = () => {
  const {
    canDraw,
    canDrawStack,
    canDobon,
    canDobonReturn,
    canPass,  // 追加
    drawCard,
    drawStack,
    drawStackCount,
    dobon,
    dobonReturn,
    pass,  // 追加
  } = useGameRoom();

  return (
    <div className="fixed bottom-[150px] right-4 flex gap-2">
      {/* 既存のボタン... */}

      {/* パスボタン */}
      {canPass && (
        <Button
          className="size-[78px] bg-gray-500/80 text-white hover:bg-gray-600"
          onClick={pass}
          variant="ghost"
        >
          <span className="text-sm font-bold">パス</span>
        </Button>
      )}
    </div>
  );
};
```

**→ コミットして作業を止める**

---

## Step 6: 動作確認

1. 開発サーバーを起動（`/dev-start`）
2. 2つのブラウザでゲームに参加
3. 以下を確認:
   - ドローする前はパスボタンが表示されない
   - ドロー後にパスボタンが表示される
   - パスボタンをクリックすると次のプレイヤーに手番が移る
   - タイムアウト時にパスが実行される（ドロー済みの場合）

**→ コミットして作業を止める（実装完了）**

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/server/src/commands/PassCommand.test.ts` | 新規作成 |
| `apps/server/src/commands/PassCommand.ts` | 実装 |
| `apps/client/src/hooks/useGameRoom.ts` | canPass, pass 追加 |
| `apps/client/src/components/game/ActionButtons.tsx` | パスボタン追加 |

---

## 注意点

1. **PlayerActionUpdater との連携**
   - `player.canPass = this.state.hasDrawnThisTurn` は既に実装済み
   - PassCommand では `this.room.playerActionUpdater.update()` を呼び出すだけでよい

2. **TimeoutHandler との連携**
   - タイムアウト時のパス呼び出しは既に実装済み
   - PassCommand が正しく実装されれば連携は自動的に機能する

3. **advanceToNextPlayer の再利用**
   - PlayCardCommand と同じユーティリティを使用
   - `apps/server/src/utils/playerActions.ts` から import

4. **ドボン判定の更新**
   - PlayerActionUpdater.update() で自動的に処理される
   - 場のカードの点数に基づいて各プレイヤーの canDobon を更新
