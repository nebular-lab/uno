# ChooseColorCommand 実装計画

ワイルドカード（Wild、Draw4）を出したプレイヤーが色を選択するコマンドの実装。

**参照ドキュメント:**
- `doc/spec/game-rule.md` - 色選択、タイムアウト処理

---

## 現状

### サーバー側
- `ChooseColorCommand.ts`: スタブのみ（TODO状態）
- `GameRoom.ts`: `chooseColor`メッセージハンドラー登録済み
- `TimeoutHandler.ts`: タイムアウト時にChooseColorCommandをディスパッチ済み
- `PlayerActionUpdater.ts`: `canChooseColor`の更新ロジック実装済み
- `GameState`: `waitingForColorChoice`、`currentColor`フィールドあり
- `Player`: `canChooseColor`フィールドあり

### クライアント側
- `GameScreen.tsx`: 色選択UIコンポーネント実装済み
- `useGameRoom.ts`: `chooseColor`関数、`canChooseColor`フラグ公開済み

**結論: サーバー側のChooseColorCommandの実装のみ必要**

---

## 作業フロー

**重要: 各ステップ完了後、必ずコミットして作業を止めること。**

1. ステップの作業を実行
2. テストがパスすることを確認
3. コミットを作成（メッセージ例: `Step N: 〇〇を追加`）
4. 作業を停止し、次のステップは別のセッションで実行

---

## Step 1: ChooseColorCommand のテスト作成

**新規ファイル:** `apps/server/src/commands/ChooseColorCommand.test.ts`

### テストケース

1. **バリデーション**
   - canChooseColorがfalseの場合は拒否
   - 無効な色は拒否（red, blue, green, yellow以外）

2. **実行**
   - currentColorが選択した色に更新される
   - waitingForColorChoiceがfalseになる
   - 次のプレイヤーに手番が移る
   - 手番プレイヤーのタイマーが開始される

3. **アクション更新**
   - 選択後、canChooseColorがfalseになる
   - 次のプレイヤーのplayableCardsが正しく計算される
   - canDobonが正しく更新される

4. **Draw4 + 色選択**
   - Draw4を出した後、色選択
   - 選択後、次のプレイヤーがdrawStackを持つ

### テストヘルパー

```typescript
import { Dispatcher } from "@colyseus/command";
import { Card, GameState, Player } from "@dobon-uno/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChooseColorCommand } from "./ChooseColorCommand";

// モックGameRoom
const createMockRoom = () => ({
  state: new GameState(),
  dispatcher: {} as Dispatcher<any>,
  turnTimerService: {
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
  },
  broadcast: vi.fn(),
});
```

**→ テストファイル作成後、コミットして作業を止める**

---

## Step 2: ChooseColorCommand の validate() 実装

**変更ファイル:** `apps/server/src/commands/ChooseColorCommand.ts`

`canChooseColor`フラグはPlayerActionUpdaterで以下の条件を満たす場合にtrueになる:
- フェーズがplaying
- 手番プレイヤーである
- `waitingForColorChoice`がtrue

よって、validateでは`canChooseColor`と色の有効性のみチェックすればよい。

```typescript
import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

interface Payload {
  sessionId: string;
  color: string;
}

const VALID_COLORS = ["red", "blue", "green", "yellow"] as const;

export class ChooseColorCommand extends Command<GameRoom, Payload> {
  validate({ sessionId, color }: Payload): boolean {
    const player = this.state.players.get(sessionId);
    if (!player) return false;

    // canChooseColorで手番・フェーズ・色選択待ちをまとめて確認
    if (!player.canChooseColor) return false;

    // 有効な色かチェック
    if (!VALID_COLORS.includes(color as typeof VALID_COLORS[number])) {
      return false;
    }

    return true;
  }

  execute({ sessionId, color }: Payload) {
    // Step 3で実装
  }
}
```

**対応テスト:**
- バリデーション: canChooseColorがfalseの場合は拒否
- バリデーション: 無効な色は拒否

**→ テストがパスすることを確認し、コミットして作業を止める**

---

## Step 3: ChooseColorCommand の execute() 実装

**変更ファイル:** `apps/server/src/commands/ChooseColorCommand.ts`

```typescript
import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TimeoutHandler } from "../services/TimeoutHandler";
import { advanceToNextPlayer } from "../utils/playerActions";

interface Payload {
  sessionId: string;
  color: string;
}

const VALID_COLORS = ["red", "blue", "green", "yellow"] as const;

export class ChooseColorCommand extends Command<GameRoom, Payload> {
  validate({ sessionId, color }: Payload): boolean {
    const player = this.state.players.get(sessionId);
    if (!player) return false;
    if (!player.canChooseColor) return false;
    if (!VALID_COLORS.includes(color as typeof VALID_COLORS[number])) {
      return false;
    }
    return true;
  }

  execute({ sessionId, color }: Payload) {
    // タイマー停止
    this.room.turnTimerService.stopTimer(sessionId);

    // 色を設定
    this.state.currentColor = color;
    this.state.waitingForColorChoice = false;

    // 次のプレイヤーに手番を移す
    advanceToNextPlayer(this.state);

    // 全プレイヤーのアクション可否を更新
    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    const totalPlayedPoints = fieldCard.points * this.state.lastPlayedCount;

    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({
      cardPlayerId: sessionId,
      totalPlayedPoints,
    });

    // 次のプレイヤーのタイマーを開始
    this.startCurrentPlayerTimer();
  }

  private startCurrentPlayerTimer(): void {
    const currentPlayerId = this.state.currentTurnPlayerId;
    const timeoutHandler = new TimeoutHandler(this.state, this.room.dispatcher);

    this.room.turnTimerService.startTimer(currentPlayerId, () => {
      timeoutHandler.handle(currentPlayerId);
    });
  }
}
```

**対応テスト:**
- 実行: currentColorが選択した色に更新される
- 実行: waitingForColorChoiceがfalseになる
- 実行: 次のプレイヤーに手番が移る
- アクション更新: 選択後、canChooseColorがfalseになる
- アクション更新: 次のプレイヤーのplayableCardsが正しく計算される

**→ テストがパスすることを確認し、コミットして作業を止める（実装完了）**

---

## 検証ポイント

### 手動テスト

1. **ワイルドカードを出した後の色選択**
   - Wildカードを出す → 色選択UIが表示される
   - 色を選択 → 次のプレイヤーに手番が移る
   - 選択した色が場のカードとして有効

2. **Draw4を出した後の色選択**
   - Draw4を出す → 色選択UIが表示される
   - 色を選択 → 次のプレイヤーに手番が移る
   - drawStackが累積される

3. **色選択中のタイムアウト**
   - ワイルドカードを出す → 色選択待ち
   - 10秒経過 → ランダムに色が選択される
   - ゲームが継続する

4. **色選択中のカットイン**
   - ワイルドカードを出す → 色選択待ち
   - 他プレイヤーがカットイン → カットインしたプレイヤーが色を選択

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/server/src/commands/ChooseColorCommand.test.ts` | 新規作成 |
| `apps/server/src/commands/ChooseColorCommand.ts` | 実装 |
