# LLM CPU プレイヤー設計書

## 概要

Vercel AI SDKを使用して、LLMベースのCPUプレイヤーを実装する。
CPUプレイヤーはターンが回ってきた際に、ゲーム状態を分析し、最適なアクションを選択・実行する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                      GameRoom (サーバー)                     │
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │  PlayerAction    │    │       CPUPlayer             │   │
│  │    Updater       │───▶│  (ターンが回ってきたら起動)   │   │
│  └──────────────────┘    │                             │   │
│                          │  ┌───────────────────────┐  │   │
│                          │  │   CPUActionDecider    │  │   │
│                          │  │   (Vercel AI SDK)     │  │   │
│                          │  │                       │  │   │
│                          │  │  - ゲーム状態分析      │  │   │
│                          │  │  - Tool Calling       │  │   │
│                          │  │  - アクション選択      │  │   │
│                          │  └───────────────────────┘  │   │
│                          │             │               │   │
│                          │             ▼               │   │
│                          │  ┌───────────────────────┐  │   │
│                          │  │    Dispatcher         │  │   │
│                          │  │ (PlayCard, Draw, etc) │  │   │
│                          │  └───────────────────────┘  │   │
│                          └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## CPUプレイヤーの識別

### Player スキーマの拡張

```typescript
// packages/shared/src/schema/Player.ts
export class Player extends Schema {
  // 既存フィールド...

  @type("boolean")
  isCpu: boolean = false;  // CPUプレイヤーかどうか

  @type("string")
  cpuPersonality?: string;  // CPUの性格（オプション）
}
```

### CPU用セッションID

CPUプレイヤーには特別なセッションIDを付与する：
- 形式: `cpu-{uuid}` (例: `cpu-a1b2c3d4`)
- サーバー内部で生成し、Colyseusクライアントは接続しない

## CPUが実行可能なアクション

| アクション | 説明 | パラメータ |
|-----------|------|-----------|
| `playCard` | カードを出す | `cardIds: string[]` |
| `drawCard` | 山札から1枚引く | なし |
| `drawStack` | 累積カードを全て引く | なし |
| `pass` | パスして次のプレイヤーへ | なし |
| `dobon` | ドボンを宣言 | なし |
| `dobonReturn` | ドボン返しを宣言 | なし |
| `chooseColor` | ワイルドカード後に色を選択 | `color: Color` |

## Vercel AI SDK Tool 定義

```typescript
// apps/server/src/cpu/tools.ts
import { tool } from "ai";
import { z } from "zod";

export const cpuTools = {
  playCard: tool({
    description: "手札からカードを出す。重ね出しも可能。",
    parameters: z.object({
      cardIds: z
        .array(z.string())
        .describe("出すカードのID配列（重ね出しの場合は複数）"),
    }),
  }),

  drawCard: tool({
    description: "山札から1枚カードを引く。",
    parameters: z.object({}),
  }),

  drawStack: tool({
    description: "累積されたドローカード分をすべて引く（Draw2/Draw4効果）。",
    parameters: z.object({}),
  }),

  pass: tool({
    description: "パスして次のプレイヤーにターンを渡す。山札を引いた後のみ可能。",
    parameters: z.object({}),
  }),

  dobon: tool({
    description: "ドボンを宣言する。手札の合計点数が場のカードと一致する時のみ可能。",
    parameters: z.object({}),
  }),

  dobonReturn: tool({
    description: "ドボン返しを宣言する。",
    parameters: z.object({}),
  }),

  chooseColor: tool({
    description: "ワイルドカードやドロー4を出した後に、次の有効な色を選択する。",
    parameters: z.object({
      color: z
        .enum(["red", "blue", "green", "yellow"])
        .describe("選択する色"),
    }),
  }),
};
```

## CPUActionDecider 実装

```typescript
// apps/server/src/cpu/CPUActionDecider.ts
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { GameState } from "@dobon-uno/shared/schema";
import type { Player } from "@dobon-uno/shared/schema";
import { cpuTools } from "./tools";

export interface CPUDecision {
  action: string;
  params?: Record<string, unknown>;
}

export class CPUActionDecider {
  private model = anthropic("claude-sonnet-4-20250514");

  async decide(
    state: GameState,
    cpuPlayer: Player
  ): Promise<CPUDecision> {
    const context = this.buildContext(state, cpuPlayer);
    const availableTools = this.filterAvailableTools(cpuPlayer);

    const result = await generateText({
      model: this.model,
      tools: availableTools,
      toolChoice: "required", // 必ずツールを呼び出す
      maxSteps: 1,
      system: this.getSystemPrompt(),
      prompt: context,
    });

    // ツール呼び出し結果を解析
    const toolCall = result.toolCalls[0];
    return {
      action: toolCall.toolName,
      params: toolCall.args,
    };
  }

  private buildContext(state: GameState, cpuPlayer: Player): string {
    const fieldCard = state.fieldCards[state.fieldCards.length - 1];
    const playableCardIds = Array.from(cpuPlayer.playableCards.entries())
      .filter(([_, canPlay]) => canPlay)
      .map(([cardId]) => cardId);

    return `
## 現在のゲーム状態

### 場の状況
- 場のカード: ${fieldCard.id} (色: ${fieldCard.color}, 値: ${fieldCard.value}, 点数: ${fieldCard.points})
- 現在有効な色: ${state.currentColor}
- 累積ドロー: ${state.drawStack}枚
- ターン方向: ${state.turnDirection === 1 ? "時計回り" : "反時計回り"}
- 山札残り: ${state.deckCount}枚

### あなたの手札
${cpuPlayer.myHand.map((c) => `- ${c.id} (色: ${c.color}, 値: ${c.value}, 点数: ${c.points})`).join("\n")}

### 出せるカード
${playableCardIds.length > 0 ? playableCardIds.join(", ") : "なし"}

### 可能なアクション
- カードを出す: ${cpuPlayer.playableCards.size > 0 ? "可能" : "不可"}
- 山札を引く: ${cpuPlayer.canDraw ? "可能" : "不可"}
- 累積を引く: ${cpuPlayer.canDrawStack ? "可能" : "不可"}
- パス: ${cpuPlayer.canPass ? "可能" : "不可"}
- ドボン: ${cpuPlayer.canDobon ? "可能" : "不可"}
- 色選択: ${cpuPlayer.canChooseColor ? "必要" : "不要"}

### 他のプレイヤーの状況
${Array.from(state.players.values())
  .filter((p) => p.sessionId !== cpuPlayer.sessionId && !p.isSpectator)
  .map((p) => `- ${p.name}: 手札${p.handCount}枚`)
  .join("\n")}

最適なアクションを1つ選んでください。
`;
  }

  private filterAvailableTools(player: Player) {
    const available: Record<string, typeof cpuTools[keyof typeof cpuTools]> = {};

    // 出せるカードがある場合
    if (player.playableCards.size > 0) {
      available.playCard = cpuTools.playCard;
    }

    if (player.canDraw) {
      available.drawCard = cpuTools.drawCard;
    }

    if (player.canDrawStack) {
      available.drawStack = cpuTools.drawStack;
    }

    if (player.canPass) {
      available.pass = cpuTools.pass;
    }

    if (player.canDobon) {
      available.dobon = cpuTools.dobon;
    }

    if (player.canDobonReturn) {
      available.dobonReturn = cpuTools.dobonReturn;
    }

    if (player.canChooseColor) {
      available.chooseColor = cpuTools.chooseColor;
    }

    return available;
  }

  private getSystemPrompt(): string {
    return `あなたはドボンUNOのCPUプレイヤーです。
与えられたゲーム状態を分析し、最適なアクションを選択してください。

## 基本戦略

### 最優先アクション
1. ドボンできる場合は必ずドボンする
2. ドボン返しができる場合は必ずドボン返しをする

### 通常プレイ
- 基本的に自分は上がりに向かう
- 出せるカードがある場合は基本的に出す
- 自分の手札合計が20点でも、山札を引かずにカードを出す
- 手札合計を「0〜9、10、20、30、50」のいずれかぴったりにすることを目指す（ドボン返し可能状態）
- 例: 手札が1,2,8,+2,+2の場合、1を出して残り2+8+20+20=50にする
- 記号カード（Skip, Reverse, Draw2, Wild, Draw4）は優先して早めに切る

### ドボンへの警戒（相手にドボンされないためのルール）
相手の手札枚数によって「危険な点数」が異なる：
- **1枚、3枚、4枚**: 20を警戒
- **2枚**: 20はあまり警戒しなくて良い
- **4枚、5枚、6枚**: 30を警戒
- **4枚、5枚、6枚、7枚**: 50を警戒

### 危険なカードの扱い
危険なカードとは、出すと場のカードが相手にドボンされやすい点数になるカード。

**危険カードを出さない場合:**
- 相手がドボンしやすい点数になってしまう場合
- 自分の手札枚数が多く、ドボンされると大ダメージを受ける場合
- → 代わりに山札を引く

**危険カードを出しても良い場合:**
- 出した後の場のカードが0〜9、10、20、30、50点になる場合（安全な点数）
- ドボン返しが可能な状態の場合（積極的に出す）
- 自分の手札が少なく、上がりに近い場合

### 色選択
ワイルドカードやドロー4を出した後は、次に出したいカードの色を選ぶ。
例: ドボン返しを狙える記号カードがある場合は、その色を選ぶ。

## 重ね出しルール
- 同じ数字のカードは複数枚同時に出せる
- 重ね出しすると手札を早く減らせて有利

## 注意事項
- 出せないカードを選ばないこと
- 必ず1つのアクションを選択すること
`;
  }
}
```

## CPUPlayer サービス

```typescript
// apps/server/src/cpu/CPUPlayer.ts
import type { Dispatcher } from "@colyseus/command";
import type { GameState } from "@dobon-uno/shared/schema";
import type { Player } from "@dobon-uno/shared/schema";
import { CPUActionDecider } from "./CPUActionDecider";
import { PlayCardCommand } from "../commands/PlayCardCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
import { DobonCommand } from "../commands/DobonCommand";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";

export class CPUPlayerService {
  private decider = new CPUActionDecider();
  private thinkingDelay = 1000; // 思考時間の演出（ms）

  async handleTurn(
    state: GameState,
    cpuPlayer: Player,
    dispatcher: Dispatcher
  ): Promise<void> {
    // CPUプレイヤーでない場合は何もしない
    if (!cpuPlayer.isCpu) return;

    // 思考時間の演出
    await this.delay(this.thinkingDelay);

    try {
      const decision = await this.decider.decide(state, cpuPlayer);
      await this.executeAction(decision, cpuPlayer.sessionId, dispatcher);
    } catch (error) {
      console.error("CPU decision error:", error);
      // フォールバック: 可能なアクションを順に試す
      await this.executeFallbackAction(cpuPlayer, dispatcher);
    }
  }

  private async executeAction(
    decision: { action: string; params?: Record<string, unknown> },
    sessionId: string,
    dispatcher: Dispatcher
  ): Promise<void> {
    switch (decision.action) {
      case "playCard":
        await dispatcher.dispatch(new PlayCardCommand(), {
          sessionId,
          cardIds: decision.params?.cardIds as string[],
        });
        break;

      case "drawCard":
        await dispatcher.dispatch(new DrawCardCommand(), {
          sessionId,
        });
        break;

      case "drawStack":
        await dispatcher.dispatch(new DrawStackCommand(), {
          sessionId,
        });
        break;

      case "pass":
        await dispatcher.dispatch(new PassCommand(), {
          sessionId,
        });
        break;

      case "dobon":
        await dispatcher.dispatch(new DobonCommand(), {
          sessionId,
        });
        break;

      case "chooseColor":
        await dispatcher.dispatch(new ChooseColorCommand(), {
          sessionId,
          color: decision.params?.color as string,
        });
        break;

      default:
        console.warn(`Unknown CPU action: ${decision.action}`);
    }
  }

  private async executeFallbackAction(
    player: Player,
    dispatcher: Dispatcher
  ): Promise<void> {
    // 優先順位: ドボン > カード出す > 累積引く > 山札引く > パス
    if (player.canDobon) {
      await dispatcher.dispatch(new DobonCommand(), {
        sessionId: player.sessionId,
      });
    } else if (player.playableCards.size > 0) {
      const cardId = Array.from(player.playableCards.entries())
        .find(([_, canPlay]) => canPlay)?.[0];
      if (cardId) {
        await dispatcher.dispatch(new PlayCardCommand(), {
          sessionId: player.sessionId,
          cardIds: [cardId],
        });
      }
    } else if (player.canDrawStack) {
      await dispatcher.dispatch(new DrawStackCommand(), {
        sessionId: player.sessionId,
      });
    } else if (player.canDraw) {
      await dispatcher.dispatch(new DrawCardCommand(), {
        sessionId: player.sessionId,
      });
    } else if (player.canPass) {
      await dispatcher.dispatch(new PassCommand(), {
        sessionId: player.sessionId,
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## GameRoom への統合

```typescript
// apps/server/src/rooms/GameRoom.ts
import { CPUPlayerService } from "../cpu/CPUPlayer";

export class GameRoom extends Room<GameState> {
  private cpuService = new CPUPlayerService();

  onCreate(options: any) {
    // 既存の初期化処理...

    // CPUプレイヤーの追加
    if (options.cpuCount > 0) {
      for (let i = 0; i < options.cpuCount; i++) {
        this.addCPUPlayer(`CPU ${i + 1}`);
      }
    }
  }

  private addCPUPlayer(name: string): void {
    const sessionId = `cpu-${crypto.randomUUID()}`;
    const player = new Player();
    player.sessionId = sessionId;
    player.name = name;
    player.isCpu = true;
    player.seatId = this.getNextSeatId();
    this.state.players.set(sessionId, player);
  }

  // PlayerActionUpdater.update() 後に呼び出す
  private async checkCPUTurn(): Promise<void> {
    const currentPlayer = this.state.players.get(
      this.state.currentTurnPlayerId
    );

    if (currentPlayer?.isCpu && this.state.phase === "playing") {
      await this.cpuService.handleTurn(
        this.state,
        currentPlayer,
        this.dispatcher
      );
    }
  }
}
```

## 環境変数

```env
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

## パッケージ依存関係

```json
// apps/server/package.json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "zod": "^3.23.0"
  }
}
```

## CPUプレイヤーの性格（拡張案）

将来的に、異なる戦略を持つCPUを実装可能：

```typescript
type CPUPersonality =
  | "aggressive"   // 攻撃的（ドロー系カード優先）
  | "defensive"    // 守備的（手札を減らすことを優先）
  | "random"       // ランダム
  | "strategic";   // 戦略的（デフォルト）
```

システムプロンプトを性格に応じて変更することで、多様なCPUを実現できる。

## シーケンス図

```
┌──────────┐     ┌───────────┐     ┌─────────────┐     ┌──────────┐
│ GameRoom │     │ Updater   │     │ CPUService  │     │ AI SDK   │
└────┬─────┘     └─────┬─────┘     └──────┬──────┘     └────┬─────┘
     │                 │                   │                 │
     │ アクション実行後  │                   │                 │
     │────────────────▶│                   │                 │
     │                 │                   │                 │
     │                 │ update()          │                 │
     │                 │──────────────────▶│                 │
     │                 │                   │                 │
     │                 │ CPUターンか確認     │                 │
     │◀────────────────│                   │                 │
     │                 │                   │                 │
     │ checkCPUTurn()  │                   │                 │
     │────────────────────────────────────▶│                 │
     │                 │                   │                 │
     │                 │                   │ decide()        │
     │                 │                   │────────────────▶│
     │                 │                   │                 │
     │                 │                   │ generateText()  │
     │                 │                   │◀────────────────│
     │                 │                   │ (tool call)     │
     │                 │                   │                 │
     │ dispatcher.dispatch()               │                 │
     │◀────────────────────────────────────│                 │
     │                 │                   │                 │
```

## 考慮事項

### パフォーマンス

- LLM呼び出しは非同期で行い、ゲーム進行をブロックしない
- タイムアウト設定（5秒程度）を設けてフォールバックに切り替える
- 思考時間の演出を入れることで、人間らしさを演出

### コスト

- Haiku を使用してコストを抑制（1回のリクエストあたり約0.1円以下）
- ツール呼び出しのみを使用し、レスポンス生成は最小限に

### エラーハンドリング

- API呼び出しエラー時はフォールバック戦略を使用
- 無効なアクションが返された場合も同様にフォールバック

## テスト方針

1. **単体テスト**: CPUActionDecider のコンテキスト生成をテスト
2. **統合テスト**: モックAI SDKを使用してフロー全体をテスト
3. **E2Eテスト**: 実際のAI APIを使用したゲームプレイテスト
