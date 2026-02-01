# DrawCardCommand 実装計画

## Step 1: DrawCardCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/DrawCardCommand.test.ts`

テストケース:

1. **バリデーション**
   - canDraw=false の場合は拒否
   - canDraw=true の場合は許可

2. **実行**
   - 山札から1枚引いて手札に追加される
   - handCountが1増加する
   - deckCountが1減少する
   - hasDrawnThisTurn=true になる
   - canDraw=false, canPass=true になる
   - playableCardsが再計算される（引いたカードも含む）
   - タイマーがリセットされる
   - 手番プレイヤーは変わらない

3. **山札切れ**
   - 最後の1枚を引いた場合、ゲームが終了する（phase=result）

---

## Step 2: DrawCardCommand の validate() 実装

**変更ファイル:** `apps/server/src/commands/DrawCardCommand.ts`

```typescript
validate({ sessionId }: Payload): boolean {
  const player = this.state.players.get(sessionId);
  if (!player) return false;

  return player.canDraw;
}
```

**対応テスト:**
- バリデーション: canDraw=false の場合は拒否
- バリデーション: canDraw=true の場合は許可

**→ コミットして作業を止める**

---

## Step 3: DrawCardCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/DrawCardCommand.ts`

```typescript
execute({ sessionId }: Payload) {
  const player = this.state.players.get(sessionId);
  if (!player) return;

  // タイマー停止
  this.room.turnTimerService.stopTimer(sessionId);

  // 山札から1枚引く
  const drawnCard = this.room.deck.pop();
  if (!drawnCard) {
    this.handleDeckOut();
    return;
  }

  // 手札に追加
  player.myHand.push(drawnCard);
  player.handCount = player.myHand.length;
  this.state.deckCount = this.room.deck.length;

  // 状態更新
  this.state.hasDrawnThisTurn = true;

  // 山札が0枚になった場合 → ゲーム終了
  if (this.room.deck.length === 0) {
    this.handleDeckOut();
    return;
  }

  // 全プレイヤーのアクション可否を更新
  const actionUpdater = new PlayerActionUpdater(this.state);
  actionUpdater.update();

  // タイマー再開
  this.startCurrentPlayerTimer();
}
```

**対応テスト:**
- 実行: 山札から1枚引いて手札に追加される
- 実行: handCountが1増加する
- 実行: deckCountが1減少する
- 実行: hasDrawnThisTurn=true になる
- 実行: canDraw=false, canPass=true になる
- 実行: playableCardsが再計算される
- 山札切れ: 最後の1枚を引いた場合、ゲームが終了する

**→ コミットして作業を止める**

---

## Step 4: フロントエンドの動作確認

**確認ファイル:**
- `apps/client/src/hooks/useGameRoom.ts` - drawCard関数（実装済み）
- `apps/client/src/components/game/ActionButtons.tsx` - 山札を引くボタン（実装済み）

フロントエンドは既に実装済み:
- `useGameRoom.ts`: drawCard関数が `room.send("drawCard")` を送信
- `ActionButtons.tsx`: canDraw=true の場合に「山札を引く」ボタンを表示

動作確認:
- ボタンクリックで山札からカードが引ける
- 引いたカードが手札に追加される
- deckCountが減少する
- canDraw=false, canPass=true になる

**→ コミットして作業を止める（実装完了）**
