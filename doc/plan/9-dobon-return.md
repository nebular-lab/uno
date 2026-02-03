# DobonReturnCommand 実装計画

ドボン返しを宣言してゲームを終了させるコマンドの実装。

**参照ドキュメント:**

- `doc/spec/game-rule.md` - ドボン返しの条件、点数計算
- `doc/plan/8-dobon.md` - DobonCommand実装（前提）

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成（メッセージ例: `Step N: 〇〇を追加`）
4. 作業を停止し、次のステップは別のセッションで実行

---

## 前提: DobonCommandのドボン返し待ち機能

DobonReturnCommandを実装する前に、DobonCommandに以下の機能が必要:

- ドボン返し可能かの判定 (`checkCanDobonReturn`)
- ドボン返し待ち状態のセットアップ (`setupDobonReturnWait`)
- ドボン返しタイマーの開始
- タイムアウト時のドボン確定処理

**DobonCommand側の実装（8-dobon.mdで実装済み）:**

```typescript
/**
 * ドボン返し可能かチェック
 * ドボンされた人の残り手札の合計点数と、ドボンした人の手札の合計点数が一致すれば可能
 */
private checkCanDobonReturn(): boolean {
  const target = this.state.players.get(this.state.dobonTargetId);
  if (!target) return false;

  const targetHandTotal = target.myHand.reduce(
    (sum, card) => sum + card.points,
    0,
  );

  for (const dobonPlayerId of this.state.dobonPlayerIds) {
    const dobonPlayer = this.state.players.get(dobonPlayerId);
    if (!dobonPlayer) continue;

    const dobonPlayerHandTotal = dobonPlayer.myHand.reduce(
      (sum, card) => sum + card.points,
      0,
    );

    if (targetHandTotal === dobonPlayerHandTotal) {
      return true;
    }
  }
  return false;
}

/**
 * ドボン返し待ち状態をセットアップ
 */
private setupDobonReturnWait(): void {
  const target = this.state.players.get(this.state.dobonTargetId);
  if (!target) {
    this.finalizeDobonFinish();
    return;
  }

  // ドボンされた人のcanDobonReturnをtrueに
  target.canDobonReturn = true;

  // タイマーを開始してドボン返しを待つ
  this.room.turnTimerService.startTimer(this.state.dobonTargetId, () => {
    const targetPlayer = this.state.players.get(this.state.dobonTargetId);
    if (targetPlayer?.canDobonReturn) {
      targetPlayer.canDobonReturn = false;
      this.finalizeDobonFinish();
    }
  });
}
```

---

## Step 1: DobonReturnCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/DobonReturnCommand.test.ts`

テストケース:

1. **バリデーション**
   - playingフェーズ以外は拒否
   - canDobonReturn=falseの場合は拒否
   - ドボンターゲットでない場合は拒否

2. **ドボン返し実行**
   - ドボン返しするとドボンした人がスコアを失う
   - ドボン返しした人がスコアを得る
   - finishTypeがdobonReturnになる

3. **タイムアウト**
   - ドボン返ししなかった場合はタイムアウトでドボン確定
   - finishTypeがdobonになる

4. **複数人ドボン**
   - 複数人ドボンの場合、ドボン返しすると全員から取る

**テストのセットアップ:**

```typescript
// Player1の手札: 5を出すと残り5点（ドボン返し用）
await setHand(client1, [testCards.red5, testCards.red2, testCards.red3]);

// Player2の手札: 合計5点（ドボン可能）
await setHand(client2, [testCards.red2, testCards.red3]);

// Player1がカードを出す → Player2がドボン → Player1がドボン返し可能
```

---

## Step 2: DobonReturnCommand の validate() 実装

**新規ファイル:** `apps/server/src/commands/DobonReturnCommand.ts`

```typescript
interface Payload {
  sessionId: string;
}

export class DobonReturnCommand extends Command<GameRoom, Payload> {
  validate({ sessionId }: Payload): boolean {
    // フェーズチェック
    if (this.state.phase !== "playing") return false;

    // プレイヤーの存在チェック
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // ドボン返し可能かチェック
    if (!player.canDobonReturn) return false;

    // ドボンターゲットであることをチェック（自分がドボンされた側であること）
    if (this.state.dobonTargetId !== sessionId) return false;

    return true;
  }
}
```

---

## Step 3: DobonReturnCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/DobonReturnCommand.ts`

```typescript
execute({ sessionId }: Payload) {
  const player = this.state.players.get(sessionId);
  if (!player) return;

  // タイマー停止
  this.room.turnTimerService.stopTimer(this.state.currentTurnPlayerId);

  // ドボン返しフラグをオフに
  player.canDobonReturn = false;

  // ドボン返し確定 → 点数計算
  this.finalizeDobonReturn(sessionId);
}
```

---

## Step 4: DobonReturnCommand の点数計算実装

**変更ファイル:** `apps/server/src/commands/DobonReturnCommand.ts`

点数計算ルール（`doc/spec/game-rule.md` より）:

- ドボンした人が、ドボン返しした人に「全員の手札の合計点数」を支払う
- 複数人がドボンしていた場合、それぞれから全員分を受け取る
- 場のカード（ドボンされた人が出したカード）の点数も含む

```typescript
/**
 * ドボン返し確定処理（点数計算、result遷移）
 */
private finalizeDobonReturn(dobonReturnPlayerId: string): void {
  // フェーズをresultに変更
  this.state.phase = "result";

  // 点数計算
  const rateMultiplier = this.state.rateMultiplier;

  // 全員の手札合計点数を計算（ドボンされた人が出したカードの点数も含む）
  const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
  const fieldCardPoints = fieldCard
    ? fieldCard.points * this.state.lastPlayedCount
    : 0;
  const totalHandPoints =
    calculateTotalHandPoints(this.state) + fieldCardPoints;

  const scoreChanges = new Map<string, number>();

  // ドボン返しした人に加算
  const winner = this.state.players.get(dobonReturnPlayerId);
  const dobonPlayerCount = this.state.dobonPlayerIds.length;
  const totalWinnings = totalHandPoints * rateMultiplier * dobonPlayerCount;

  if (winner) {
    winner.score += totalWinnings;
    scoreChanges.set(dobonReturnPlayerId, totalWinnings);
  }

  // ドボンした人からスコアを引く
  const loss = totalHandPoints * rateMultiplier;
  for (const dobonPlayerId of this.state.dobonPlayerIds) {
    const dobonPlayer = this.state.players.get(dobonPlayerId);
    if (dobonPlayer) {
      dobonPlayer.score -= loss;
      scoreChanges.set(dobonPlayerId, -loss);
    }
  }

  // GameResultを作成してgameHistoryに追加
  const gameResult = createGameResult(
    this.state,
    dobonReturnPlayerId,
    "dobonReturn",
    scoreChanges,
  );
  this.state.gameHistory.push(gameResult);

  // 次のゲームの最初のプレイヤーを設定（ドボン返しした人）
  this.state.nextGameStartPlayerId = dobonReturnPlayerId;

  // レート倍率をリセット
  this.state.rateMultiplier = 1;
  this.state.consecutiveDeckouts = 0;

  // 一定時間後にwaitingフェーズに戻る
  this.clock.setTimeout(() => {
    this.room.resetGameState();
    this.state.phase = "waiting";
  }, RESULT_DISPLAY_DURATION);
}
```

---

## Step 5: GameRoom へのメッセージハンドラ追加

**変更ファイル:** `apps/server/src/rooms/GameRoom.ts`

```typescript
this.onMessage("dobonReturn", (client) => {
  this.dispatcher.dispatch(new DobonReturnCommand(), {
    sessionId: client.sessionId,
  });
});
```

---

## Step 6: クライアント側の実装

**変更ファイル:** `apps/client/src/hooks/useGameRoom.ts`

```typescript
const dobonReturn = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("dobonReturn");
}, [gameRoomState]);

return {
  // ...
  dobonReturn,
};
```

**変更ファイル:** `apps/client/src/components/game/ActionButtons.tsx`

- ドボン返しボタンの追加
- `canDobonReturn` がtrueのときに表示

---

## ファイル変更一覧

| ファイル                                             | 変更内容                       |
| ---------------------------------------------------- | ------------------------------ |
| `apps/server/src/commands/DobonCommand.ts`           | ドボン返し待ち機能追加         |
| `apps/server/src/commands/DobonReturnCommand.test.ts`| 新規作成                       |
| `apps/server/src/commands/DobonReturnCommand.ts`     | 新規作成                       |
| `apps/server/src/rooms/GameRoom.ts`                  | dobonReturnメッセージハンドラ  |
| `apps/client/src/hooks/useGameRoom.ts`               | dobonReturn関数追加            |
| `apps/client/src/components/game/ActionButtons.tsx`  | ドボン返しボタン追加           |

---

## 点数計算の例

### 例1: 1人のドボンに対してドボン返し

```
Player1: 5点（5を出す → 残り5点）
Player2: 5点（ドボン）
Player3: 10点

Player1が5を出す → Player2がドボン → Player1がドボン返し

全員の手札: 5 + 5 + 10 = 20点
場のカード: 5点
合計: 25点

結果:
- Player1: +25点（ドボン返し成功）
- Player2: -25点（ドボンしたが返された）
- Player3: 変化なし
```

### 例2: 2人のドボンに対してドボン返し

```
Player1: 5点（5を出す → 残り5点）
Player2: 5点（ドボン）
Player3: 5点（ドボン）

Player1が5を出す → Player2がドボン → Player3がドボン → Player1がドボン返し

全員の手札: 5 + 5 + 5 = 15点
場のカード: 5点
合計: 20点

結果:
- Player1: +40点（20点 × 2人分）
- Player2: -20点
- Player3: -20点
```

---

## 注意事項

- ドボン返し返しは不可（1回のみ）
- ドボン返しのタイムアウト時間はターンタイムアウトと同じ設定を使用
- 複数人がドボンした場合、条件を満たせば全員に対してドボン返し可能
