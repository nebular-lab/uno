# NormalFinishCommand 実装計画

プレイヤーが最後の1枚を出して上がる「通常の上がり」の実装。

**参照ドキュメント:**

- `doc/spec/game-rule.md` - 点数計算、上がり処理

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成（メッセージ例: `Step N: 〇〇を追加`）
4. 作業を停止し、次のステップは別のセッションで実行

---

## Step 1: GameResult スキーマの更新

**変更ファイル:** `packages/shared/src/schema/GameResult.ts`

- `winnerId: string` を追加（勝者のsessionId）
- `finishType: string` を追加（"normal" | "dobon" | "dobonReturn"）

---

## Step 2: NormalFinishCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/NormalFinishCommand.test.ts`

テストケース:

1. **バリデーション**
   - playingフェーズ以外は拒否
   - 手札が0枚でない場合は拒否

2. **点数計算**
   - 各プレイヤーが手札合計点を失い、勝者がその合計を獲得
   - レート倍率が適用される

3. **状態更新**
   - phaseが"result"になる
   - GameResultがgameHistoryに追加される
   - nextGameStartPlayerIdが勝者に設定される
   - rateMultiplierが1にリセットされる

4. **タイマー**
   - 3秒後にphaseが"waiting"になる
   - 3秒後にゲーム状態がリセットされる

---

## Step 3: NormalFinishCommand の実装

**変更ファイル:** `apps/server/src/commands/NormalFinishCommand.ts`

- validate(): フェーズと手札枚数のチェック
- execute(): 点数計算、GameResult作成、3秒後にwaiting遷移

---

## Step 4: GameRoom.resetGameState() のテスト作成

**変更ファイル:** `apps/server/src/rooms/GameRoom.test.ts`

テストケース:

- プレイヤーの手札がクリアされる
- ゲーム状態（fieldCards, deckCount等）がリセットされる

---

## Step 5: GameRoom.resetGameState() の実装

**変更ファイル:** `apps/server/src/rooms/GameRoom.ts`

- プレイヤー状態のリセット（手札、アクションフラグ）
- ゲーム状態のリセット（場札、山札、フラグ類）

---

## Step 6: 上がり表示の追加

**変更ファイル:** `apps/client/src/components/game/PlayerSeat.tsx`

- phase="result"時、勝者のPlayerSeat上に「上がり！」と表示
- winnerId（GameResultから取得）と一致するプレイヤーに表示

---

## Step 7: ScorePanel コンポーネントの作成

**新規ファイル:** `apps/client/src/components/game/ScorePanel.tsx`

- 開閉可能なパネル（isOpen, onClose props）
- スコアボードテーブル（カラム=プレイヤー、行=各ゲームの収支、最下行=累計）
- プラスは緑、マイナスは赤で表示

---

## Step 8: ScoreButton コンポーネントの作成

**新規ファイル:** `apps/client/src/components/game/ScoreButton.tsx`

- 画面右上に配置
- クリックでScorePanelを開く

---

## Step 9: GameScreen への統合

**変更ファイル:** `apps/client/src/screens/GameScreen.tsx`

- ScorePanel, ScoreButton を追加
- パネル開閉状態の管理（useState）
- phase="result"時に自動で開く
- phase="waiting"時に自動で閉じる

---

## ファイル変更一覧

| ファイル                                               | 変更内容                      |
| ------------------------------------------------------ | ----------------------------- |
| `packages/shared/src/schema/GameResult.ts`             | winnerId, finishType 追加     |
| `apps/server/src/commands/NormalFinishCommand.test.ts` | 新規作成                      |
| `apps/server/src/commands/NormalFinishCommand.ts`      | 実装                          |
| `apps/server/src/rooms/GameRoom.test.ts`               | resetGameState テスト追加     |
| `apps/server/src/rooms/GameRoom.ts`                    | resetGameState() メソッド追加 |
| `apps/client/src/components/game/PlayerSeat.tsx`       | 上がり表示追加                |
| `apps/client/src/components/game/ScorePanel.tsx`       | 新規作成                      |
| `apps/client/src/components/game/ScoreButton.tsx`      | 新規作成                      |
| `apps/client/src/screens/GameScreen.tsx`               | ScorePanel, ScoreButton 追加  |
