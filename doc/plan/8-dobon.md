# DobonCommand 実装計画

ドボンを宣言してゲームを終了させるコマンドの実装。

**参照ドキュメント:**

- `doc/spec/game-rule.md` - ドボンの条件、点数計算

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成（メッセージ例: `Step N: 〇〇を追加`）
4. 作業を停止し、次のステップは別のセッションで実行

---

## Step 1: GameState スキーマの更新

**変更ファイル:** `packages/shared/src/schema/GameState.ts`

ドボン関連のステートを追加:

- `dobonTargetId: string` - ドボンされた人のsessionId
- `dobonPlayerIds: ArraySchema<string>` - ドボンした人のsessionIdリスト

---

## Step 2: 共通ユーティリティのテスト作成

**新規ファイル:** `apps/server/src/utils/finishGame.test.ts`

NormalFinishCommand と DobonCommand で共通化できる関数のテスト:

1. **calculateTotalHandPoints**
   - 全プレイヤーの手札合計点数を計算
   - 特定プレイヤーを除外できる

2. **createGameResult**
   - GameResultを作成
   - winnerId, finishType, scoreChanges を設定

3. **resetGameAfterDelay**
   - 一定時間後にwaitingフェーズに戻る
   - レート倍率をリセット

---

## Step 3: 共通ユーティリティの実装

**新規ファイル:** `apps/server/src/utils/finishGame.ts`

```typescript
import { GameResult, GameState } from "@dobon-uno/shared";

/** 上がり表示時間（ミリ秒） */
export const FINISH_DISPLAY_DURATION = 3000;
/** スコアパネル表示時間（ミリ秒） */
export const SCORE_DISPLAY_DURATION = 5000;
/** 結果表示合計時間（ミリ秒） */
export const RESULT_DISPLAY_DURATION =
  FINISH_DISPLAY_DURATION + SCORE_DISPLAY_DURATION;

/**
 * 全プレイヤーの手札合計点数を計算
 */
export function calculateTotalHandPoints(
  state: GameState,
  excludePlayerIds?: string[],
): number;

/**
 * GameResultを作成
 */
export function createGameResult(
  state: GameState,
  winnerId: string,
  finishType: "normal" | "dobon" | "dobonReturn",
  scoreChanges: Map<string, number>,
): GameResult;
```

---

## Step 4: NormalFinishCommand のリファクタリング

**変更ファイル:** `apps/server/src/commands/NormalFinishCommand.ts`

共通ユーティリティを使用するように変更。既存テストがパスすることを確認。

---

## Step 5: DobonCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/DobonCommand.test.ts`

テストケース:

1. **バリデーション**
   - playingフェーズ以外は拒否
   - canDobon=falseの場合は拒否
   - 存在しないプレイヤーは拒否

2. **ドボン宣言**
   - ドボンしたプレイヤーがdobonPlayerIdsに追加される
   - ドボンしたプレイヤーのcanDobonがfalseになる
   - 他にドボン可能なプレイヤーがいる場合、待機状態になる

3. **点数計算（全員ドボンした/時間切れ後）**
   - ドボンされた人が全員の手札合計点数を支払う
   - 複数人ドボンの場合、それぞれに全員分を支払う
   - レート倍率が適用される

4. **状態更新**
   - phaseが"result"になる
   - GameResultがgameHistoryに追加される（finishType="dobon"）
   - nextGameStartPlayerIdがドボンした人に設定される

5. **ドボン返し待ち**
   - ドボンされた人がドボン返し可能な場合、canDobonReturn=trueになる
   - ドボン返し待ち状態になる（タイマー開始）
   - **※ DobonReturnCommand実装後にコメントアウトを外す**

---

## Step 6: DobonCommand の validate() 実装

**変更ファイル:** `apps/server/src/commands/DobonCommand.ts`

```typescript
validate({ sessionId }: Payload): boolean {
  // フェーズチェック
  if (this.state.phase !== "playing") return false;

  // プレイヤーの存在チェック
  const player = this.state.players.get(sessionId);
  if (!player) return false;

  // ドボン可能かチェック
  if (!player.canDobon) return false;

  return true;
}
```

---

## Step 7: DobonCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/DobonCommand.ts`

```typescript
execute({ sessionId }: Payload) {
  const player = this.state.players.get(sessionId);
  if (!player) return;

  // タイマー停止
  this.room.turnTimerService.stopAllTimers();

  // ドボンしたプレイヤーを記録
  this.state.dobonPlayerIds.push(sessionId);
  player.canDobon = false;

  // ドボンされた人を特定（カードを出した人 = currentTurnPlayerId）
  if (this.state.dobonTargetId === "") {
    this.state.dobonTargetId = this.state.currentTurnPlayerId;
  }

  // 他にドボン可能なプレイヤーがいるかチェック
  const othersCanDobon = this.checkOthersCanDobon();
  if (othersCanDobon) {
    // 他のドボン待ち（タイマー開始）
    this.startDobonWaitTimer();
    return;
  }

  // ドボン返し判定
  if (this.checkCanDobonReturn()) {
    // ドボン返し待ち状態に
    this.setupDobonReturnWait();
    return;
  }

  // ドボン確定 → 点数計算
  this.finalizeDobonFinish();
}
```

---

## Step 8: DobonCommand のヘルパーメソッド実装

**変更ファイル:** `apps/server/src/commands/DobonCommand.ts`

```typescript
/**
 * 他にドボン可能なプレイヤーがいるかチェック
 */
private checkOthersCanDobon(): boolean;

/**
 * ドボン返し可能かチェック
 */
private checkCanDobonReturn(): boolean;

/**
 * ドボン待ちタイマーを開始
 */
private startDobonWaitTimer(): void;

/**
 * ドボン返し待ち状態をセットアップ
 */
private setupDobonReturnWait(): void;

/**
 * ドボン確定処理（点数計算、result遷移）
 */
private finalizeDobonFinish(): void;
```

---

## Step 9: ドボン表示の追加

**変更ファイル:** `apps/client/src/components/game/PlayerSeat.tsx`

- ドボンしたプレイヤーのPlayerSeat上に「ドボン！」と表示
- dobonPlayerIds に含まれるプレイヤーに表示
- WinnerLabelと同様のスタイルで、色を変える（例: 赤背景）

---

## Step 10: TimeoutHandler への統合

**変更ファイル:** `apps/server/src/services/TimeoutHandler.ts`

- ドボン待ちタイムアウト時の処理を追加
- ドボン返し待ちタイムアウト時の処理を追加（※DobonReturnCommand実装後）

---

## ファイル変更一覧

| ファイル                                             | 変更内容                           |
| ---------------------------------------------------- | ---------------------------------- |
| `packages/shared/src/schema/GameState.ts`            | dobonTargetId, dobonPlayerIds 追加 |
| `apps/server/src/utils/finishGame.test.ts`           | 新規作成                           |
| `apps/server/src/utils/finishGame.ts`                | 新規作成                           |
| `apps/server/src/commands/NormalFinishCommand.ts`    | リファクタリング                   |
| `apps/server/src/commands/DobonCommand.test.ts`      | 新規作成                           |
| `apps/server/src/commands/DobonCommand.ts`           | 実装                               |
| `apps/client/src/components/game/PlayerSeat.tsx`     | ドボン表示追加                     |
| `apps/server/src/services/TimeoutHandler.ts`         | ドボン待ちタイムアウト処理追加     |

---

## 注意事項

- ドボン返し（DobonReturnCommand）は別の計画で実装する
- テストで DobonReturnCommand に依存する部分はコメントアウトしておく
- コメントには「DobonReturnCommand実装後にコメントアウトを外す」と記載する
