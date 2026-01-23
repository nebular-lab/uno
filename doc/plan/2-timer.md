# Timer 実装計画

ターン制限時間（10秒）とタイムアウト処理の実装計画。

---

## 現状

- ✅ ゲーム開始カウントダウン（3, 2, 1）は実装済み
- ✅ `Player.timeRemaining` フィールドは定義済み（未使用）
- ❌ ターン制限時間（10秒）は未実装
- ❌ タイムアウト処理は未実装
- ❌ クライアント側タイマー表示は未実装

---

## 仕様（doc/spec/game-rule.md より）

### タイムアウト時間

- **10秒**: 操作可能になってから10秒間操作がない場合にタイムアウト

### タイムアウト処理

| 状況                   | 自動処理           |
| ---------------------- | ------------------ |
| 手番（未ドロー）       | 1枚引いてパス     |
| 手番（ドロー済み）     | パス               |
| 色選択中               | ランダムに色を選択 |
| ドロー累積を受ける状況 | 累積分を引く       |
| ドボン可能             | ドボンしない       |

### UI表示（doc/spec/screen.md より）

- 残り時間（10秒）を表示（自分の手番のみ）
- ドボンパネル、ドボン返しパネルにも残り時間を表示

---

## 実装方針

### サーバー主導のタイマー管理

タイマーはサーバー側で管理し、クライアントには残り時間を同期する。

**理由:**
- チート防止（クライアント側でタイマーを操作できないようにする）
- 全クライアント間で一貫した動作を保証
- タイムアウト処理をサーバーで確実に実行

### クライアント側の表示

- サーバーから同期された `turnDeadline`（締切時刻）を元に残り時間を計算
- 1秒ごとにUIを更新
- 自分の手番/ドボン可能時のみ表示

---

## スキーマ

### 既存フィールドを使用

```typescript
// Player スキーマ（既存）
@type("number") timeRemaining: number = 0; // タイマー残り秒数（0なら非アクティブ）
```

**設計意図:**
- **プレイヤーごとに独立したタイマー**を管理
- 残り秒数を直接同期（シンプルな設計）
- クライアントは `player.timeRemaining` をそのまま表示

### 複数タイマーが必要なケース

| ケース | 例 |
|--------|-----|
| 複数人が同時にドボン可能 | Aが20点を出す → B, C両方がドボン可能 |
| 色選択中 + ドボン可能 | Aがワイルドを出して色選択中 + Bがドボン可能 |

各プレイヤーの `timeRemaining` が独立しているため、上記ケースに対応可能。

---

## サーバー実装

### 1. TurnTimerService（新規）

**プレイヤーごとに独立したタイマー**を管理するサービス。
タイムアウト時の処理はコールバックとして受け取る（単一責任）。

**責務:**
- プレイヤー単位でのタイマー開始（`startTimer(playerId, onTimeout)`）
- プレイヤー単位でのタイマー停止（`stopTimer(playerId)`）
- 全タイマー停止（`stopAllTimers()`）

**実装場所:** `apps/server/src/services/TurnTimerService.ts`

```typescript
export class TurnTimerService {
  // プレイヤーごとのタイマーを管理
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  // 特定プレイヤーのタイマー開始
  startTimer(playerId: string, onTimeout: () => void): void {
    this.stopTimer(playerId); // 既存タイマーをクリア

    const player = this.state.players.get(playerId);
    if (!player) return;

    // 残り秒数を設定（SPEED_MULTIPLIER適用）
    player.timeRemaining = TIMING.TURN_TIMEOUT / 1000;

    const timer = setTimeout(() => {
      this.timers.delete(playerId);
      player.timeRemaining = 0;
      onTimeout(); // コールバックを実行
    }, TIMING.TURN_TIMEOUT);

    this.timers.set(playerId, timer);
  }

  // 特定プレイヤーのタイマー停止
  stopTimer(playerId: string): void {
    const timer = this.timers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(playerId);
    }

    const player = this.state.players.get(playerId);
    if (player) {
      player.timeRemaining = 0;
    }
  }

  // 全タイマー停止（ゲーム終了時など）
  stopAllTimers(): void {
    for (const [playerId] of this.timers) {
      this.stopTimer(playerId);
    }
  }
}
```

### 呼び出し側（Command / GameRoom）

タイムアウト処理のロジックは呼び出し側で定義:

```typescript
// 例: BeginPlayCommand でタイマー開始
timerService.startTimer(currentPlayerId, () => {
  const state = this.state;

  if (state.waitingForColorChoice) {
    // ランダムに色を選択
    const colors = ["red", "blue", "green", "yellow"] as const;
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    dispatcher.dispatch(new ChooseColorCommand(), { color: randomColor });
  } else if (state.drawStack > 0) {
    // 累積分を引く
    dispatcher.dispatch(new DrawStackCommand());
  } else if (state.hasDrawnThisTurn) {
    // パス
    dispatcher.dispatch(new PassCommand());
  } else {
    // 1枚引いてパス
    dispatcher.dispatch(new DrawCardCommand());
    dispatcher.dispatch(new PassCommand());
  }
});
```

### 2. タイミング設定の追加

**実装場所:** `apps/server/src/config/timing.ts`

```typescript
export const TIMING = {
  // ... 既存設定
  TURN_TIMEOUT: 10000 * SPEED_MULTIPLIER, // 10秒（テスト時は高速化）
};
```

※ `SPEED_MULTIPLIER` はテスト環境で `0.01` に設定されるため、テスト時は100msでタイムアウト。

### 3. タイマー開始タイミング

以下のタイミングでタイマーを開始:

1. **ターン開始時** - `NextTurnCommand` 実行後
2. **色選択待ち開始時** - ワイルド/ドロー4を出した後
3. **ドロー累積対象になった時** - ドローカードを出された後

### 4. タイマー停止タイミング

以下のタイミングでタイマーを停止:

1. **プレイヤーがアクションを実行した時** - カードを出す、引く、パスなど
2. **ゲーム終了時** - `stopAllTimers()` で全員のタイマーを停止
3. **プレイヤー退出時** - `stopTimer(playerId)` で該当プレイヤーのタイマーを停止
4. **カットインされた時** - 元プレイヤーのタイマーを停止（後続フェーズで実装）

### 5. 既存Commandの修正

各Commandでタイマーの開始/停止を呼び出す:

| Command | タイマー操作 |
|---------|-------------|
| BeginPlayCommand | 開始（最初のターン） |
| NextTurnCommand | 開始（次のターン） |
| PlayCardCommand | 停止 → 開始（次ターン or 色選択） |
| DrawCommand | 停止 → 開始（ドロー後の行動待ち） |
| PassCommand | 停止 → 開始（次ターン） |
| DrawStackCommand | 停止 → 開始（次ターン） |
| ChooseColorCommand | 停止 → 開始（次ターン） |
| GameEndCommand | 停止 |

---

## クライアント実装

### 1. TurnTimer コンポーネント（新規）

**自分のプレイヤーの `timeRemaining`** をそのまま表示。

**実装場所:** `apps/client/src/components/game/TurnTimer.tsx`

```tsx
export function TurnTimer() {
  const myPlayer = useAtomValue(myPlayerAtom);
  const timeRemaining = myPlayer?.timeRemaining ?? 0;

  if (timeRemaining === 0) return null;

  const isWarning = timeRemaining <= 3;

  return (
    <div className={cn(
      "flex size-[78px] flex-col items-center justify-center rounded-md bg-black/50 text-white",
      isWarning && "text-red-500 animate-pulse"
    )}>
      <span className="text-xs text-zinc-400">残り</span>
      <span className="text-2xl font-bold">{timeRemaining}</span>
    </div>
  );
}
```

**ポイント:**
- 自分のプレイヤー（`myPlayer`）の `timeRemaining` をそのまま表示
- サーバーから同期された値を直接使用（計算不要）
- 残り3秒以下で警告表示（赤色 + 点滅）

### 2. 表示位置・スタイル

**統一された表示方法:**
- 手札の合計表示（78px × 78px の四角UI）の**右側**に配置
- 同じスタイル（`size-[78px] rounded-md bg-black/50 text-white`）
- 自分の手番/ドボン可能/ドボン返し可能、すべて同じ位置・同じUI

**MyHand.tsx での配置:**
```tsx
<div className="absolute -top-24 left-4 flex gap-2">
  <Button ... /> {/* ソートボタン */}
  <div ...> {/* 合計表示 */}
    <span className="text-xs text-zinc-400">合計</span>
    <span className="text-2xl font-bold">{totalPoints}</span>
  </div>
  <TurnTimer /> {/* タイマー表示（合計の右側） */}
</div>
```

### 3. 視覚的フィードバック

- 残り3秒以下: 赤色表示（`text-red-500`）+ 点滅アニメーション

---

## 実装順序

### Phase 1: サーバー側基盤

1. `timing.ts` に `TURN_TIMEOUT` を追加（`SPEED_MULTIPLIER` 対応）
2. `TurnTimerService` を実装（プレイヤーごとのタイマー管理）
3. 単体テストを作成

※ `Player.timeRemaining` は既存フィールドを使用（追加不要）

### Phase 2: サーバー統合

5. `GameRoom` に `TurnTimerService` を統合
6. 各Commandにタイマー操作を追加
7. 統合テストを作成

### Phase 3: クライアント表示

8. `TurnTimer` コンポーネントを実装
9. `MyHand.tsx` に統合（合計表示の右側に配置）
10. 残り3秒以下の警告スタイル追加

---

## テスト計画

### 単体テスト

- `TurnTimerService.test.ts`
  - タイマー開始でdeadlineが設定される
  - タイマー停止でdeadlineが0になる
  - タイムアウトで適切な処理が実行される
    - 未ドロー → 1枚引いてパス
    - ドロー済み → パス
    - 色選択中 → ランダム色選択
    - ドロー累積中 → 累積分を引く

### 統合テスト

- タイムアウト後にターンが進む
- プレイヤーアクションでタイマーがリセットされる
- ゲーム終了でタイマーが停止する

---

## 考慮事項

### 同期方式

- サーバーが `timeRemaining`（残り秒数）を直接管理・同期
- クライアントはスキーマの値をそのまま表示（計算不要）
- シンプルな設計を優先

### 退出時の処理

- プレイヤー退出時は `stopTimer(playerId)` でタイマーを停止
- 退出時のタイムアウト処理（パス等）は別フェーズで実装

### ドボン/カットインのタイマー

- 現フェーズでは通常ターンのタイマーのみ実装
- ドボン/カットインは次フェーズ（カードを出す機能）で実装予定

---

## 依存関係

### 前提

- ゲーム開始機能（Phase 1 完了済み）

### 後続

- カードを出す機能（Phase 3）でドボン/カットインのタイマーを追加
