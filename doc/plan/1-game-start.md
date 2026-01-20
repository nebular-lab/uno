# GameStartCommand 実装計画


## 概要

ゲームを開始するコマンド。**段階的に**山札生成、カード配布、カウントダウン、最初の場札の公開を行う。

---

## ゲーム開始の流れ（段階的進行）

```
[待機中] → [カード配布] → [カウントダウン] → [カード公開] → [プレイ中]
 waiting     dealing        countdown         revealing       playing
```

| 段階 | phase | 説明 | 所要時間 |
|------|-------|------|----------|
| 1 | `dealing` | カードを配る（アニメーション付き）、最初の手番プレイヤーをハイライト | 約2.5秒 |
| 2 | `countdown` | 3, 2, 1のカウントダウン表示 | 3秒 |
| 3 | `revealing` | 1枚目のカードをめくる | 1秒 |
| 4 | `playing` | ゲーム開始（カードを出せるようになる） | - |

**重要:** `playing` フェーズになるまで、プレイヤーはカードを出すことができない。

---

## カード配布アニメーション

### アニメーションの動作

カード配布は **7ラウンド** に分けて行う。各ラウンドで全プレイヤーに1枚ずつ同時に配布。

```
ラウンド1: 山札 → 全員に1枚目（同時に飛んでいく）
ラウンド2: 山札 → 全員に2枚目（同時に飛んでいく）
  ...
ラウンド7: 山札 → 全員に7枚目（同時に飛んでいく）
```

### 視覚的な表現

1. **山札**（画面中央）からカードが各プレイヤーの位置に飛んでいく
2. 飛んでいるカードは**裏向き**で表示
3. 自分の位置に到着したカードは**表向き**に変わる（他プレイヤーは裏向きのまま）
4. 1ラウンドあたり約300ms、合計約2.1秒 + バッファで約2.5秒

### 実装方式の比較

| 方式 | メリット | デメリット |
|------|----------|------------|
| **A. サーバー主導** | 全クライアントで同期が取れる | サーバー負荷、実装が複雑 |
| **B. クライアント主導** | サーバーシンプル | 同期がずれる可能性 |
| **C. ハイブリッド** | バランスが良い | 両方の実装が必要 |

### 採用方式: サーバー主導（方式A）

サーバーが `dealingRound` を更新し、クライアントはその値に応じてアニメーションを表示する。

**理由:**
- 全クライアントで配布のタイミングが同期される
- クライアントはサーバーの状態変更に反応するだけでシンプル
- 途中参加や再接続時にも正しい状態が表示される

### スキーマ追加

```typescript
// GameState への追加フィールド
@type("number") dealingRound: number = 0; // 0-7 (0=配布前, 1-7=各ラウンド)
```

### サーバー側の実装

```typescript
// StartGameCommand 内でカードを段階的に配布
execute(payload: Payload) {
  // ... 権限チェック等

  this.state.phase = "dealing";
  this.state.dealingRound = 0;

  // 山札を生成・シャッフル
  const deck = createDeck();
  const shuffled = shuffleDeck(deck);
  this.room.deck = shuffled; // ルームに一時保存

  // 最初のプレイヤーを決定してハイライト
  this.state.currentTurnPlayerId = this.determineFirstPlayer(payload.startPlayerId);

  // 配布アニメーション開始
  this.dealNextRound();
}

private dealNextRound() {
  this.state.dealingRound++;

  // 各プレイヤーに1枚ずつ配布（退出したプレイヤーがいても継続）
  for (const player of this.state.players.values()) {
    const card = this.room.deck.pop();
    player.myHand.push(card);
    player.handCount++;
  }
  this.state.deckCount = this.room.deck.length;

  if (this.state.dealingRound < 7) {
    // 次のラウンドへ（300ms後）
    this.room.clock.setTimeout(() => this.dealNextRound(), 300);
  } else {
    // 配布完了、最初の場札を決定
    this.state.firstCard = this.room.deck.pop();
    this.state.deckCount = this.room.deck.length;

    // 500ms後にカウントダウン開始
    this.room.clock.setTimeout(() => {
      this.room.dispatcher.dispatch(new CountdownCommand());
    }, 500);
  }
}
```

### クライアント側の実装

#### アニメーションライブラリ

**motion** を追加する（旧framer-motion、位置の補間アニメーションに最適）。

```bash
cd apps/client
pnpm add motion
```

※ React 18.2以上が必要。Viteでは追加設定不要。

#### カード配布アニメーションコンポーネント

**新規ファイル:** `apps/client/src/components/game/DealingAnimation.tsx`

```tsx
import { AnimatePresence, motion } from "motion/react";

type Props = {
  dealingRound: number;
  playerPositions: { x: number; y: number }[]; // 各プレイヤーの位置
  deckPosition: { x: number; y: number }; // 山札の位置
};

export const DealingAnimation = ({
  dealingRound,
  playerPositions,
  deckPosition,
}: Props) => {
  // dealingRound が変わるたびに、そのラウンドのカードをアニメーション
  return (
    <AnimatePresence>
      {dealingRound > 0 && (
        <>
          {playerPositions.map((pos, index) => (
            <motion.div
              key={`deal-${dealingRound}-${index}`}
              className="absolute w-12 h-16 bg-blue-800 rounded-lg border-2 border-white"
              initial={{
                x: deckPosition.x,
                y: deckPosition.y,
                scale: 1,
                opacity: 1,
              }}
              animate={{
                x: pos.x,
                y: pos.y,
                scale: 0.8,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.25,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
};
```

#### 手札の表示（段階的に増える）

```tsx
// MyHand コンポーネント
export const MyHand = ({ cards, dealingRound }: Props) => {
  // dealingRound の枚数だけ表示
  const visibleCards = cards.slice(0, dealingRound);

  return (
    <div className="flex gap-2">
      <AnimatePresence>
        {visibleCards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ y: -50, opacity: 0, rotateY: 180 }}
            animate={{ y: 0, opacity: 1, rotateY: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <CardComponent card={card} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
```

### アニメーションなしオプション

アニメーションを無効にするオプションも用意（アクセシビリティ対応）。

```typescript
// ユーザー設定
interface UserSettings {
  reduceMotion: boolean; // アニメーションを減らす
}

// reduceMotion が true の場合、duration を 0 に
const duration = settings.reduceMotion ? 0 : 0.25;
```

---

## 仕様（game-rule.md / room.md より）

### 開始条件

- オーナーのみがゲーム開始可能
- 3人以上で開始可能（最大6人）

### 最初のカードの処理

| カード     | 処理                                                           |
| ---------- | -------------------------------------------------------------- |
| 数字       | そのまま開始                                                   |
| スキップ   | 最初のプレイヤーがスキップ                                     |
| リバース   | 順番が逆になりオーナーの右隣から開始                           |
| ドロー2    | 2枚引くか、ドロー2/4を重ねて出せる                             |
| ワイルド   | 最初のプレイヤーが色を選択                                     |
| ドロー4    | 4枚引くか、ドロー4を重ねて出せる                               |
| 強制色変え | そのカードの色でそのまま開始（色選択不要）                     |

### カード構成（112枚）

- 数字カード（76枚）: 0は各色1枚、1-9は各色2枚
- 記号カード（24枚）: スキップ、リバース、ドロー2が各色2枚ずつ
- ワイルドカード（8枚）: ワイルド4枚、ドロー4が4枚
- 強制色変えカード（4枚）: 各色1枚ずつ

---

## スキーマ変更

### GameState への追加フィールド

```typescript
// packages/shared/src/schema/GameState.ts

// phase の値を拡張
// "waiting" | "dealing" | "countdown" | "revealing" | "playing" | "result"
@type("string") phase: string = "waiting";

// カード配布ラウンド（0-7: 0=配布前, 1-7=各ラウンド）
@type("number") dealingRound: number = 0;

// カウントダウン用（3, 2, 1, 0）
@type("number") countdown: number = 0;

// 最初の場札（裏向きで保持、revealingフェーズで公開）
@type(Card) firstCard: Card | null = null;
```

### Player への追加フィールド

```typescript
// packages/shared/src/schema/Player.ts

// 接続状態（trueで接続中、falseで切断中）
@type("boolean") connected: boolean = true;
```

**補足:** `connected` は GameRoom の `onLeave` / `onJoin` で更新する。切断中のプレイヤーにもカード配布は継続する（再接続時に手札が復元される）。

---

## 実装手順

**TDD（テスト駆動開発）方式で実装する。各Commandはテストを先に書いてから実装する。**

| Step | 内容 | 方式 |
|------|------|------|
| 1 | テスト環境のセットアップ | - |
| 2 | ヘルパー関数の実装 | - |
| 3 | StartGameCommand | テスト → 実装 |
| 4 | CountdownCommand | テスト → 実装 |
| 5 | RevealCardCommand | テスト → 実装 |
| 6 | BeginPlayCommand | テスト → 実装 |
| 7 | GameRoomにメッセージハンドラ追加 | - |
| 8 | クライアント側の実装 | - |
| 9 | ゲーム画面の実装 | - |

---

### Step 1: テスト環境のセットアップ

Colyseus公式のテストパッケージ `@colyseus/testing` とvitestを導入する。

**参考:** https://docs.colyseus.io/tools/unit-testing

**ファイル変更:**

- `apps/server/package.json` - 依存関係追加
- `apps/server/vitest.config.ts` - vitest設定ファイル作成
- `apps/server/src/test/setup.ts` - テストセットアップファイル作成

**インストールするパッケージ:**

```bash
cd apps/server
pnpm add -D vitest @colyseus/testing
```

**テストセットアップ:**

```typescript
// apps/server/src/test/setup.ts
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../app.config";

let colyseus: ColyseusTestServer;

export async function setupTestServer() {
  colyseus = await boot(appConfig);
  return colyseus;
}

export async function shutdownTestServer() {
  await colyseus.shutdown();
}

export async function cleanupTestServer() {
  await colyseus.cleanup();
}

export { colyseus };
```

**vitest設定:**

```typescript
// apps/server/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
});
```

**package.jsonにスクリプト追加:**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

### Step 2: ヘルパー関数の実装

山札生成やカード関連のユーティリティをsharedパッケージに追加。

**新規ファイル:** `packages/shared/src/deck.ts`

```typescript
// 山札を生成する関数
export function createDeck(): Card[] { ... }

// 山札をシャッフルする関数
export function shuffleDeck(deck: Card[]): Card[] { ... }

// 手札にカードを配る関数
export function dealCards(deck: Card[], count: number): { dealt: Card[], remaining: Card[] } { ... }
```

---

### Step 3: StartGameCommand（テスト → 実装）

**TDD方式:** テストを先に書いてから実装する。

#### 3-1. テストを書く

**新規ファイル:** `apps/server/src/commands/StartGameCommand.test.ts`

```typescript
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import appConfig from "../app.config";

describe("StartGameCommand", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  describe("権限チェック", () => {
    it("オーナー以外は開始できない", async () => {
      const room = await colyseus.createRoom("game", {});
      await colyseus.connectTo(room, { playerName: "Owner" });
      const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      player2.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.phase).toBe("waiting");
    });

    it("3人未満では開始できない", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.phase).toBe("waiting");
    });

    it("waiting状態以外では開始できない", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // 1回目の開始
      owner.send("startGame");
      await room.waitForNextPatch();

      // 2回目の開始（すでにdealing状態）
      const currentPhase = room.state.phase;
      owner.send("startGame");
      await room.waitForNextPatch();

      // フェーズがリセットされていないこと
      expect(room.state.phase).not.toBe("waiting");
    });
  });

  describe("カード配布（dealingフェーズ）", () => {
    it("3人でゲーム開始するとdealingフェーズになる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.phase).toBe("dealing");
    });

    it("dealingRoundが1から始まり段階的に増える", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.dealingRound).toBeGreaterThanOrEqual(1);

      // dealingRoundが増えていくことを確認
      const rounds: number[] = [room.state.dealingRound];
      while (room.state.dealingRound < 7 && room.state.phase === "dealing") {
        await room.waitForNextPatch();
        if (!rounds.includes(room.state.dealingRound)) {
          rounds.push(room.state.dealingRound);
        }
      }

      expect(rounds).toContain(1);
      expect(rounds[rounds.length - 1]).toBe(7);
    });

    it("各プレイヤーに7枚ずつ配られる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      while (room.state.dealingRound < 7) {
        await room.waitForNextPatch();
      }

      for (const player of room.state.players.values()) {
        expect(player.handCount).toBe(7);
      }
    });

    it("山札枚数が正しい（112 - 7×プレイヤー数 - 1）", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      while (room.state.phase === "dealing") {
        await room.waitForNextPatch();
      }

      // 112 - (7 × 3) - 1 = 90
      expect(room.state.deckCount).toBe(90);
    });

    it("最初のプレイヤーがcurrentTurnPlayerIdに設定される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.currentTurnPlayerId).toBeTruthy();
    });
  });
});
```

#### 3-2. 実装する

**変更ファイル:** `apps/server/src/commands/StartGameCommand.ts`

```typescript
import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { createDeck, shuffleDeck } from "@dobon-uno/shared";
import { CountdownCommand } from "./CountdownCommand";

interface Payload {
  sessionId: string;
  startPlayerId?: string;
  rateMultiplier?: number;
}

export class StartGameCommand extends Command<GameRoom, Payload> {
  execute(payload: Payload) {
    // 1. 権限チェック
    if (!this.validateStart(payload.sessionId)) return;

    // 2. フェーズを "dealing" に変更
    this.state.phase = "dealing";
    this.state.dealingRound = 0;

    // 3. 山札を生成・シャッフル
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    this.room.deck = shuffled;

    // 4. 最初のプレイヤーを決定してハイライト
    this.state.currentTurnPlayerId = this.determineFirstPlayer(payload.startPlayerId);

    // 5. 段階的なカード配布を開始
    this.dealNextRound();
  }

  private validateStart(sessionId: string): boolean {
    // waiting状態か
    if (this.state.phase !== "waiting") return false;

    // オーナーか
    const player = this.state.players.get(sessionId);
    if (!player?.isOwner) return false;

    // 3人以上か
    if (this.state.players.size < 3) return false;

    return true;
  }

  private determineFirstPlayer(startPlayerId?: string): string {
    if (startPlayerId && this.state.players.has(startPlayerId)) {
      return startPlayerId;
    }
    // 座席順でソートしてオーナーの左隣（次のプレイヤー）を決定
    const sortedBySeat = Array.from(this.state.players.values())
      .sort((a, b) => a.seatId - b.seatId);
    const ownerIndex = sortedBySeat.findIndex(p => p.isOwner);
    const nextIndex = (ownerIndex + 1) % sortedBySeat.length;
    return sortedBySeat[nextIndex].sessionId;
  }

  private dealNextRound() {
    this.state.dealingRound++;

    for (const player of this.state.players.values()) {
      const card = this.room.deck.pop();
      if (card) {
        player.myHand.push(card);
        player.handCount++;
      }
    }
    this.state.deckCount = this.room.deck.length;

    if (this.state.dealingRound < 7) {
      this.room.clock.setTimeout(() => this.dealNextRound(), 300);
    } else {
      this.state.firstCard = this.room.deck.pop();
      this.state.deckCount = this.room.deck.length;

      this.room.clock.setTimeout(() => {
        this.room.dispatcher.dispatch(new CountdownCommand());
      }, 500);
    }
  }
}
```

---

### Step 4: CountdownCommand（テスト → 実装）

#### 4-1. テストを書く

**新規ファイル:** `apps/server/src/commands/CountdownCommand.test.ts`

```typescript
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import appConfig from "../app.config";

describe("CountdownCommand", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("dealingフェーズ完了後にcountdownフェーズになる", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "countdown") {
      await room.waitForNextPatch();
    }

    expect(room.state.phase).toBe("countdown");
  });

  it("countdownが3から始まる", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "countdown") {
      await room.waitForNextPatch();
    }

    expect(room.state.countdown).toBe(3);
  });

  it("countdownが3→2→1→0と減少する", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "countdown") {
      await room.waitForNextPatch();
    }

    const countdownValues: number[] = [room.state.countdown];
    while (room.state.countdown > 0 && room.state.phase === "countdown") {
      await room.waitForNextPatch();
      if (!countdownValues.includes(room.state.countdown)) {
        countdownValues.push(room.state.countdown);
      }
    }

    expect(countdownValues).toContain(3);
    expect(countdownValues).toContain(2);
    expect(countdownValues).toContain(1);
  });

  it("countdown完了後にrevealingフェーズに移行する", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "revealing" && room.state.phase !== "playing") {
      await room.waitForNextPatch();
    }

    expect(["revealing", "playing"]).toContain(room.state.phase);
  });
});
```

#### 4-2. 実装する

**新規ファイル:** `apps/server/src/commands/CountdownCommand.ts`

```typescript
import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import { RevealCardCommand } from "./RevealCardCommand";

export class CountdownCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "countdown";
    this.state.countdown = 3;

    const tick = () => {
      this.state.countdown--;

      if (this.state.countdown > 0) {
        this.room.clock.setTimeout(tick, 1000);
      } else {
        this.room.dispatcher.dispatch(new RevealCardCommand());
      }
    };

    this.room.clock.setTimeout(tick, 1000);
  }
}
```

---

### Step 5: RevealCardCommand（テスト → 実装）

#### 5-1. テストを書く

**新規ファイル:** `apps/server/src/commands/RevealCardCommand.test.ts`

```typescript
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import appConfig from "../app.config";

describe("RevealCardCommand", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("countdown完了後にrevealingフェーズになる", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "revealing" && room.state.phase !== "playing") {
      await room.waitForNextPatch();
    }

    // revealingを通過したことを確認（playingでもOK）
    expect(["revealing", "playing"]).toContain(room.state.phase);
  });

  it("fieldCardsに1枚追加される", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "revealing" && room.state.phase !== "playing") {
      await room.waitForNextPatch();
    }

    expect(room.state.fieldCards.length).toBe(1);
  });

  it("currentColorが設定される", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    while (room.state.phase !== "revealing" && room.state.phase !== "playing") {
      await room.waitForNextPatch();
    }

    expect(room.state.currentColor).toBeTruthy();
  });

  describe("最初のカード特殊処理", () => {
    // 注: これらのテストは山札をモックする必要があるため、
    // 実際の実装時に詳細を追加する

    it("スキップカードの場合、次のプレイヤーが手番になる", async () => {
      // TODO: 山札をモックしてスキップカードを最初に出す
    });

    it("リバースカードの場合、turnDirectionが-1になる", async () => {
      // TODO: 山札をモックしてリバースカードを最初に出す
    });

    it("ドロー2カードの場合、drawStackが2になる", async () => {
      // TODO: 山札をモックしてドロー2カードを最初に出す
    });

    it("ワイルドカードの場合、playingフェーズでwaitingForColorChoiceがtrueになる", async () => {
      // TODO: 山札をモックしてワイルドカードを最初に出す
      // playingフェーズになってから色選択状態になることを確認
    });
  });
});
```

#### 5-2. 実装する

**新規ファイル:** `apps/server/src/commands/RevealCardCommand.ts`

```typescript
import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";
import type { Card } from "@dobon-uno/shared";
import { BeginPlayCommand } from "./BeginPlayCommand";

export class RevealCardCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "revealing";

    const firstCard = this.state.firstCard;
    if (firstCard) {
      this.state.fieldCards.push(firstCard);
      this.state.currentColor = this.getCardColor(firstCard);
      this.handleFirstCardEffect(firstCard);
    }

    this.room.clock.setTimeout(() => {
      this.room.dispatcher.dispatch(new BeginPlayCommand());
    }, 1000);
  }

  private getCardColor(card: Card): string {
    if (card.color === "wild") {
      return ""; // ワイルドの場合は色選択待ち（playingフェーズで選択）
    }
    return card.color;
  }

  private handleFirstCardEffect(card: Card) {
    switch (card.value) {
      case "skip":
        this.advanceToNextPlayer();
        break;
      case "reverse":
        this.state.turnDirection = -1;
        this.recalculateFirstPlayer();
        break;
      case "draw2":
        this.state.drawStack = 2;
        break;
      case "wild":
        // ※ waitingForColorChoice は BeginPlayCommand で設定（playingフェーズで色選択）
        break;
      case "draw4":
        this.state.drawStack = 4;
        // ※ waitingForColorChoice は BeginPlayCommand で設定（playingフェーズで色選択）
        break;
      case "force-change":
        // 色はカードの色で自動設定済み
        break;
      default:
        // 数字カード: 何もしない
        break;
    }
  }

  private advanceToNextPlayer() {
    // 座席順でソートして次のプレイヤーを決定
    const sortedBySeat = Array.from(this.state.players.values())
      .sort((a, b) => a.seatId - b.seatId);
    const currentIndex = sortedBySeat.findIndex(
      p => p.sessionId === this.state.currentTurnPlayerId
    );
    const direction = this.state.turnDirection;
    const nextIndex = (currentIndex + direction + sortedBySeat.length) % sortedBySeat.length;
    this.state.currentTurnPlayerId = sortedBySeat[nextIndex].sessionId;
  }

  private recalculateFirstPlayer() {
    // リバース時：オーナーの右隣（逆方向）から開始
    const sortedBySeat = Array.from(this.state.players.values())
      .sort((a, b) => a.seatId - b.seatId);
    const ownerIndex = sortedBySeat.findIndex(p => p.isOwner);
    // turnDirection が -1 なので、逆方向に進む
    const nextIndex = (ownerIndex - 1 + sortedBySeat.length) % sortedBySeat.length;
    this.state.currentTurnPlayerId = sortedBySeat[nextIndex].sessionId;
  }
}
```

---

### Step 6: BeginPlayCommand（テスト → 実装）

#### 6-1. テストを書く

**新規ファイル:** `apps/server/src/commands/BeginPlayCommand.test.ts`

```typescript
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import appConfig from "../app.config";

describe("BeginPlayCommand", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("最終的にplayingフェーズになる", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    const timeout = Date.now() + 15000; // 15秒タイムアウト
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    expect(room.state.phase).toBe("playing");
  });

  it("手番プレイヤーのcanDrawがtrueになる", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    const currentPlayer = room.state.players.get(room.state.currentTurnPlayerId);
    expect(currentPlayer?.canDraw).toBe(true);
  });

  it("手番でないプレイヤーのcanDrawはfalse", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    for (const [sessionId, player] of room.state.players.entries()) {
      if (sessionId !== room.state.currentTurnPlayerId) {
        expect(player.canDraw).toBe(false);
      }
    }
  });

  it("playingフェーズになる前はカードを出せない", async () => {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");
    await room.waitForNextPatch();

    // dealingフェーズ中にカードを出そうとする
    owner.send("playCard", ["dummy-card-id"]);
    await room.waitForNextPatch();

    // カードが出されていないことを確認
    expect(room.state.fieldCards.length).toBe(0);
  });
});
```

#### 6-2. 実装する

**新規ファイル:** `apps/server/src/commands/BeginPlayCommand.ts`

```typescript
import { Command } from "@colyseus/command";
import type { GameRoom } from "../rooms/GameRoom";

export class BeginPlayCommand extends Command<GameRoom> {
  execute() {
    this.state.phase = "playing";

    // 最初のカードがワイルド/ドロー4の場合、playingフェーズで色選択状態にする
    const firstCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (firstCard && (firstCard.value === "wild" || firstCard.value === "draw4")) {
      this.state.waitingForColorChoice = true;
    }

    this.updatePlayerActions();
  }

  private updatePlayerActions() {
    for (const [sessionId, player] of this.state.players.entries()) {
      const isCurrentTurn = sessionId === this.state.currentTurnPlayerId;

      // 手番プレイヤーのアクション設定
      if (isCurrentTurn) {
        player.canDraw = !this.state.waitingForColorChoice && this.state.drawStack === 0;
        player.canDrawStack = this.state.drawStack > 0;
        player.canChooseColor = this.state.waitingForColorChoice;
        player.canPass = false;
        player.canDobon = false;
        player.canDobonReturn = false;

        // 出せるカードを計算
        this.calculatePlayableCards(player);
      } else {
        // 手番でないプレイヤー
        player.canDraw = false;
        player.canDrawStack = false;
        player.canChooseColor = false;
        player.canPass = false;
        player.canDobon = false; // TODO: ドボン判定
        player.canDobonReturn = false;
        player.playableCards.clear();
      }
    }
  }

  private calculatePlayableCards(player: any) {
    player.playableCards.clear();

    if (this.state.waitingForColorChoice) {
      return; // 色選択待ちの場合は出せない
    }

    const fieldCard = this.state.fieldCards[this.state.fieldCards.length - 1];
    if (!fieldCard) return;

    for (const card of player.myHand) {
      if (this.canPlayCard(card, fieldCard)) {
        player.playableCards.set(card.id, true);
      }
    }
  }

  private canPlayCard(card: any, fieldCard: any): boolean {
    // ワイルドカードは常に出せる
    if (card.color === "wild") return true;

    // 強制色変えカードは常に出せる
    if (card.value === "force-change") return true;

    // 色が一致
    if (card.color === this.state.currentColor) return true;

    // 数字/記号が一致
    if (card.value === fieldCard.value) return true;

    return false;
  }
}
```

---

### Step 7: GameRoomにメッセージハンドラを追加

**変更ファイル:** `apps/server/src/rooms/GameRoom.ts`

```typescript
import { StartGameCommand } from "../commands/StartGameCommand";
import type { Card } from "@dobon-uno/shared";

export class GameRoom extends Room<GameState, RoomMetadata> {
  dispatcher = new Dispatcher(this);
  maxClients = 6;

  // 山札（サーバー側のみ保持、クライアントには同期しない）
  deck: Card[] = [];

  // ... 既存のコード
}

// registerMessageHandlers内に追加
this.onMessage("startGame", (client) => {
  this.dispatcher.dispatch(new StartGameCommand(), {
    sessionId: client.sessionId,
    startPlayerId: this.state.nextGameStartPlayerId || undefined,
    rateMultiplier: this.state.rateMultiplier,
  });
});
```

---

### Step 8: クライアント側の実装

#### 8-0. motionのインストール

```bash
cd apps/client
pnpm add motion
```

#### 8-1. useGameRoomにstartGame関数を追加

**変更ファイル:** `apps/client/src/hooks/useGameRoom.ts`

```typescript
const startGame = useCallback(() => {
  if (gameRoomState.status !== "connected") return;
  gameRoomState.room.send("startGame");
}, [gameRoomState]);

return {
  // ... 既存の返り値
  startGame,
  phase: gameRoomState.room?.state?.phase ?? "waiting",
  dealingRound: gameRoomState.room?.state?.dealingRound ?? 0,
  countdown: gameRoomState.room?.state?.countdown ?? 0,
};
```

#### 8-2. WaitingRoomScreenでstartGame関数を使用

**変更ファイル:** `apps/client/src/screens/WaitingRoomScreen.tsx`

```typescript
const { startGame, /* ... */ } = useGameRoom();

// ゲーム開始ボタンのonClick
onClick={startGame}
```

#### 8-3. phase変更に応じた画面遷移・表示切り替え

**変更ファイル:** `apps/client/src/App.tsx`

```typescript
// waitingでないphaseはGameScreenで表示
useEffect(() => {
  const phase = gameState.phase;
  if (phase !== "waiting") {
    setScreen("game");
  }
}, [gameState.phase]);
```

---

### Step 9: ゲーム画面の実装

**新規ファイル:** `apps/client/src/screens/GameScreen.tsx`

フェーズに応じて表示を切り替える。

```tsx
export const GameScreen = () => {
  const {
    phase,
    dealingRound,
    countdown,
    players,
    fieldCards,
    myHand,
    currentTurnPlayerId,
  } = useGameRoom();

  return (
    <TableContainer>
      {/* プレイヤーシート（常に表示、手番プレイヤーはハイライト） */}
      {players.map((player, index) => (
        <PlayerSeat
          key={index}
          player={player}
          isCurrentTurn={player?.sessionId === currentTurnPlayerId}
        />
      ))}

      {/* カード配布アニメーション（dealingフェーズのみ） */}
      {phase === "dealing" && (
        <DealingAnimation
          dealingRound={dealingRound}
          playerPositions={playerPositions}
          deckPosition={deckPosition}
        />
      )}

      {/* カウントダウン表示（countdownフェーズのみ） */}
      {phase === "countdown" && (
        <CountdownOverlay count={countdown} />
      )}

      {/* 場のカード（revealingフェーズ以降） */}
      {(phase === "revealing" || phase === "playing") && (
        <FieldCard card={fieldCards[0]} />
      )}

      {/* 自分の手札（dealingフェーズ以降、段階的に表示） */}
      {phase !== "waiting" && (
        <MyHand
          cards={myHand}
          visibleCount={phase === "dealing" ? dealingRound : myHand.length}
          disabled={phase !== "playing"}
        />
      )}
    </TableContainer>
  );
};
```

#### カード配布アニメーション

**新規ファイル:** `apps/client/src/components/game/DealingAnimation.tsx`

```tsx
import { AnimatePresence, motion } from "motion/react";

type Props = {
  dealingRound: number;
  playerPositions: { x: number; y: number }[];
  deckPosition: { x: number; y: number };
};

export const DealingAnimation = ({
  dealingRound,
  playerPositions,
  deckPosition,
}: Props) => {
  return (
    <AnimatePresence>
      {dealingRound > 0 && (
        <>
          {playerPositions.map((pos, index) => (
            <motion.div
              key={`deal-${dealingRound}-${index}`}
              className="absolute w-12 h-16 bg-blue-800 rounded-lg border-2 border-white z-40"
              initial={{
                x: deckPosition.x,
                y: deckPosition.y,
                scale: 1,
                opacity: 1,
              }}
              animate={{
                x: pos.x,
                y: pos.y,
                scale: 0.8,
                opacity: 0,
              }}
              transition={{
                duration: 0.25,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
};
```

#### カウントダウンオーバーレイ

**新規ファイル:** `apps/client/src/components/game/CountdownOverlay.tsx`

```tsx
import { motion, AnimatePresence } from "motion/react";

export const CountdownOverlay = ({ count }: { count: number }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          className="text-9xl font-bold text-white"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
```

#### 手札コンポーネント（段階的表示対応）

**新規ファイル:** `apps/client/src/components/game/MyHand.tsx`

```tsx
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./Card";

type Props = {
  cards: CardData[];
  visibleCount: number;
  disabled: boolean;
};

export const MyHand = ({ cards, visibleCount, disabled }: Props) => {
  const visibleCards = cards.slice(0, visibleCount);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
      <AnimatePresence>
        {visibleCards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ y: -100, opacity: 0, rotateY: 180 }}
            animate={{ y: 0, opacity: 1, rotateY: 0 }}
            transition={{
              delay: index * 0.05,
              duration: 0.3,
              type: "spring",
              stiffness: 300,
            }}
          >
            <Card card={card} disabled={disabled} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
```

---

## 状態変更まとめ（フェーズ別）

### dealing フェーズ

| フィールド          | 変更内容                          |
| ------------------- | --------------------------------- |
| phase               | "waiting" → "dealing"             |
| dealingRound        | 0 → 1 → 2 → ... → 7（段階的に更新）|
| deckCount           | 各ラウンドで減少                  |
| firstCard           | 配布完了後に設定（非公開）        |
| currentTurnPlayerId | 最初のプレイヤーのID              |
| Player.myHand       | 各ラウンドで1枚ずつ追加           |
| Player.handCount    | 各ラウンドで1ずつ増加（最終的に7）|

### countdown フェーズ

| フィールド | 変更内容                    |
| ---------- | --------------------------- |
| phase      | "dealing" → "countdown"     |
| countdown  | 3 → 2 → 1 → 0               |

### revealing フェーズ

| フィールド           | 変更内容                   |
| -------------------- | -------------------------- |
| phase                | "countdown" → "revealing"  |
| fieldCards           | firstCardを追加            |
| currentColor         | 最初のカードの色（ワイルド系は空文字） |
| turnDirection        | リバース時は-1             |
| drawStack            | ドロー2/4時は2または4      |
| currentTurnPlayerId  | スキップ/リバース時は再計算 |

### playing フェーズ

| フィールド            | 変更内容                                    |
| --------------------- | ------------------------------------------- |
| phase                 | "revealing" → "playing"                     |
| waitingForColorChoice | ワイルド/ドロー4が最初のカードの場合にtrue  |
| Player.canDraw        | 手番プレイヤーのみtrue                      |
| Player.canPass        | false                                       |
| Player.canDrawStack   | ドロー累積がある場合のみtrue                |
| Player.canChooseColor | ワイルド/ドロー4時のみtrue                  |
| Player.playableCards  | 出せるカードをマーク                        |

---

## タイムライン

```
0ms      - startGame受信
         - phase: "dealing"
         - 最初のプレイヤーハイライト
         - dealingRound: 1（1枚目配布）

300ms    - dealingRound: 2（2枚目配布）
600ms    - dealingRound: 3（3枚目配布）
900ms    - dealingRound: 4（4枚目配布）
1200ms   - dealingRound: 5（5枚目配布）
1500ms   - dealingRound: 6（6枚目配布）
1800ms   - dealingRound: 7（7枚目配布）

2300ms   - phase: "countdown"
         - countdown: 3

3300ms   - countdown: 2

4300ms   - countdown: 1

5300ms   - phase: "revealing"
         - 場札公開、特殊効果適用

6300ms   - phase: "playing"
         - ゲーム開始、カード操作可能
```

**合計所要時間:** 約6.3秒

---

## テスト実行方法

```bash
# サーバーのテストを実行
cd apps/server
pnpm test

# ウォッチモードで実行
pnpm test:watch
```

**使用ライブラリ:**
- `vitest` - テストランナー
- `@colyseus/testing` - Colyseus公式テストユーティリティ

**参考:** https://docs.colyseus.io/tools/unit-testing

---

## 完了条件

- [ ] vitest と @colyseus/testing が動作する
- [ ] 全テストがパスする
- [ ] motionがインストールされている
- [ ] ゲーム開始ボタンをクリックするとカード配布アニメーションが始まる
- [ ] カードが山札から各プレイヤーに飛んでいくアニメーションが表示される
- [ ] 7ラウンドかけて段階的にカードが配られる
- [ ] 最初の手番プレイヤーがハイライトされる
- [ ] 3, 2, 1のカウントダウンが表示される
- [ ] カウントダウン後に場札がめくられる
- [ ] playingフェーズになるまでカードを出せない
- [ ] playingフェーズになるとカードを出せるようになる
- [ ] 最初のカードに応じた特殊処理が正しく動作する
- [ ] `pnpm check` がパスする
- [ ] `pnpm typecheck` がパスする
