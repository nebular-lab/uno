# DrawStackCommand 実装計画

ドロー累積（ドロー2/ドロー4が重なった状態）を引くコマンドの実装。

**参照ドキュメント:**
- `doc/spec/game-rule.md` - セクション5「ドローカードの累積」

---

## 仕様

### ルール（game-rule.md より）

- ドロー2にはドロー2またはドロー4を重ねて出せる
- ドロー4にはドロー4のみ重ねて出せる
- 重ねられない場合、累積分を引く
- **手札にドローカードがあっても、あえて引くことを選択できる**
- 山札切れの場合、引ける分だけ引いてゲーム終了

### 状態

| フィールド | 説明 |
|-----------|------|
| `GameState.drawStack` | 累積ドロー枚数（2, 4, 6, ...） |
| `Player.canDrawStack` | ドロー累積を引けるか |

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成
4. 作業を停止し、次のステップは別のセッションで実行

---

## Step 1: DrawStackCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/DrawStackCommand.test.ts`

テストケース:

1. **バリデーション**
   - canDrawStack=false の場合は拒否
   - canDrawStack=true の場合は許可
   - 手札にドローカードがあっても引くことを選択できる

2. **実行**
   - 累積枚数分のカードを山札から引く
   - handCount が累積枚数分増加する
   - deckCount が累積枚数分減少する
   - drawStack が 0 にリセットされる
   - 次のプレイヤーに手番が移る
   - hasDrawnThisTurn は false のまま（通常ドローとは異なる）
   - canDrawStack=false, canDraw=true になる
   - playableCards が再計算される
   - タイマーが次のプレイヤーで開始される

3. **山札切れ**
   - 累積分を引く途中で山札が切れた場合、引ける分だけ引いてゲーム終了

**→ コミットして作業を止める**

---

## Step 2: DrawStackCommand の validate() 実装

**変更ファイル:** `apps/server/src/commands/DrawStackCommand.ts`

```typescript
validate({ sessionId }: Payload): boolean {
  const player = this.state.players.get(sessionId);
  if (!player) return false;

  return player.canDrawStack;
}
```

**対応テスト:**
- バリデーション: canDrawStack=false の場合は拒否
- バリデーション: canDrawStack=true の場合は許可

**→ コミットして作業を止める**

---

## Step 3: DrawStackCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/DrawStackCommand.ts`

```typescript
execute({ sessionId }: Payload) {
  const player = this.state.players.get(sessionId);
  if (!player) return;

  // タイマー停止
  this.room.turnTimerService.stopTimer(sessionId);

  // 累積枚数を取得
  const drawCount = this.state.drawStack;

  // 累積枚数分のカードを引く
  for (let i = 0; i < drawCount; i++) {
    const drawnCard = this.room.deck.pop();
    if (!drawnCard) {
      // 山札切れ → ゲーム終了
      this.handleDeckOut();
      return;
    }

    // 手札に追加
    player.myHand.push(drawnCard);
  }

  // カウント更新
  player.handCount = player.myHand.length;
  this.state.deckCount = this.room.deck.length;

  // 累積リセット
  this.state.drawStack = 0;

  // 山札が0枚になった場合 → ゲーム終了
  if (this.room.deck.length === 0) {
    this.handleDeckOut();
    return;
  }

  // 次のプレイヤーに手番を移す
  advanceToNextPlayer(this.state);

  // 全プレイヤーのアクション可否を更新
  const actionUpdater = new PlayerActionUpdater(this.state);
  actionUpdater.update();

  // タイマー再開（次のプレイヤー）
  this.startCurrentPlayerTimer();
}

private handleDeckOut(): void {
  this.room.dispatcher.dispatch(new DeckOutCommand(), {});
}

private startCurrentPlayerTimer(): void {
  const currentPlayerId = this.state.currentTurnPlayerId;
  const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);

  this.room.turnTimerService.startTimer(currentPlayerId, () => {
    timeoutHandler.handle(currentPlayerId);
  });
}
```

**対応テスト:**
- 実行: 累積枚数分のカードを山札から引く
- 実行: handCount が累積枚数分増加する
- 実行: deckCount が累積枚数分減少する
- 実行: drawStack が 0 にリセットされる
- 実行: 次のプレイヤーに手番が移る
- 山札切れ: 引ける分だけ引いてゲーム終了

**→ コミットして作業を止める**

---

## Step 4: フロントエンドの動作確認

**確認ファイル:**
- `apps/client/src/hooks/useGameRoom.ts` - drawStack関数（実装済み）
- `apps/client/src/components/game/ActionButtons.tsx` - ドロースタックを引くボタン（実装済み）

フロントエンドは既に実装済み:
- `useGameRoom.ts`: drawStack関数が `room.send("drawStack")` を送信
- `ActionButtons.tsx`: canDrawStack=true の場合に「{drawStackCount}枚引く」ボタンを表示

動作確認:
1. ドロー2/ドロー4が出された状態を作る
2. 「○枚引く」ボタンが表示される
3. ボタンクリックで累積枚数分のカードが引ける
4. drawStack が 0 にリセットされる
5. 次のプレイヤーに手番が移る

**→ コミットして作業を止める（実装完了）**

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/server/src/commands/DrawStackCommand.test.ts` | 新規作成 |
| `apps/server/src/commands/DrawStackCommand.ts` | validate() / execute() 実装 |

---

## 関連コマンドとの違い

| コマンド | 用途 | drawStack | 手番移動 |
|---------|------|-----------|----------|
| DrawCardCommand | 任意ドロー（1枚） | 0 の時のみ実行可能 | 移動しない |
| DrawStackCommand | 累積ドロー | 累積分を引く | 次のプレイヤーへ |

---

## 注意事項

- `hasDrawnThisTurn` は変更しない（任意ドローのフラグ）
- 累積ドローを引いた後は通常のターンになる（カードを出すか任意ドローができる）
- ドローカード（ドロー2/4）を持っていても引くことを選択できる（ルール準拠）
