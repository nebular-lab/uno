# LLM CPU プレイヤー設計書

UNOゲームにLLM（大規模言語モデル）を使用したCPUプレイヤーを追加するための設計・実装計画ドキュメント。

**使用ライブラリ**: [Vercel AI SDK](https://ai-sdk.dev/)

---

## 1. 実装計画

### Phase 1: 基盤構築

| タスク | 内容 | 成果物 |
|-------|------|-------|
| 1-1 | 依存パッケージのインストール | package.json更新 |
| 1-2 | 出力スキーマ定義（Zod） | `schemas/actionSchema.ts` |
| 1-3 | LLMプロバイダー抽象化クラス作成 | `LLMProvider.ts` |
| 1-4 | 環境変数設定 | `.env.example` 更新 |

### Phase 2: プロンプト設計

| タスク | 内容 | 成果物 |
|-------|------|-------|
| 2-1 | システムプロンプト作成 | `prompts/systemPrompt.ts` |
| 2-2 | ゲーム状態フォーマッター作成 | `prompts/gameStateFormatter.ts` |
| 2-3 | プロンプトのテスト・調整 | テストケース |

### Phase 3: CPUサービス実装

| タスク | 内容 | 成果物 |
|-------|------|-------|
| 3-1 | CPUPlayerService実装 | `CPUPlayerService.ts` |
| 3-2 | フォールバック（ルールベース）実装 | `RuleBasedCPU.ts` |
| 3-3 | 単体テスト作成 | `*.test.ts` |

### Phase 4: ゲーム統合

| タスク | 内容 | 成果物 |
|-------|------|-------|
| 4-1 | Playerスキーマ拡張（isCPUフラグ） | `Player.ts` 更新 |
| 4-2 | GameRoomへのCPU統合 | `GameRoom.ts` 更新 |
| 4-3 | CPUプレイヤー追加API | メッセージハンドラー追加 |
| 4-4 | 統合テスト | E2Eテスト |

### Phase 5: クライアント対応

| タスク | 内容 | 成果物 |
|-------|------|-------|
| 5-1 | CPU追加UIコンポーネント | React コンポーネント |
| 5-2 | CPU思考中の表示演出 | アニメーション |
| 5-3 | 難易度選択UI | 設定画面 |

---

## 2. アーキテクチャ

### 2.1 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                    GameRoom (Colyseus)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐    ┌───────────────┐                │
│  │ Human Player  │    │  CPU Player   │                │
│  │  (WebSocket)  │    │  (LLMAgent)   │                │
│  └───────────────┘    └───────┬───────┘                │
│                               │                         │
│                    ┌──────────▼──────────┐             │
│                    │   CPUPlayerService  │             │
│                    └──────────┬──────────┘             │
│                               │                         │
│                    ┌──────────▼──────────┐             │
│                    │     LLMProvider     │             │
│                    │  (AI SDK wrapper)   │             │
│                    └──────────┬──────────┘             │
│                               │                         │
└───────────────────────────────┼─────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    LLM API / Ollama   │
                    └───────────────────────┘
```

### 2.2 ディレクトリ構成

```
apps/server/src/
├── cpu/
│   ├── LLMProvider.ts           # LLM API抽象化
│   ├── CPUPlayerService.ts      # CPUプレイヤー管理
│   ├── RuleBasedCPU.ts          # フォールバック用ルールベースCPU
│   ├── prompts/
│   │   ├── systemPrompt.ts      # システムプロンプト
│   │   └── gameStateFormatter.ts # ゲーム状態のフォーマット
│   └── schemas/
│       └── actionSchema.ts      # アクション出力スキーマ
├── services/
│   └── ...
└── ...
```

---

## 3. 出力スキーマ定義

### 3.1 アクションスキーマ

```typescript
// apps/server/src/cpu/schemas/actionSchema.ts
import { z } from 'zod';

/**
 * CPUプレイヤーのアクション出力スキーマ
 */
export const ActionSchema = z.object({
  // 実行するアクションの種類
  action: z.enum([
    'playCard',    // カードを出す
    'draw',        // 山札から1枚引く
    'drawStack',   // 累積カードを引く
    'pass',        // パス
    'chooseColor', // 色を選択
    'dobon',       // ドボン宣言
    'dobonReturn', // ドボン返し
  ]).describe('実行するアクションの種類'),

  // カードを出す場合のカードID（複数可: 重ね出し対応）
  cardIds: z.array(z.string()).optional()
    .describe('出すカードのID。playCardの場合は必須。重ね出しの場合は複数指定'),

  // 色選択の場合の色
  color: z.enum(['red', 'blue', 'green', 'yellow']).optional()
    .describe('chooseColorの場合に選択する色'),

  // 思考過程（デバッグ・ログ用）
  reasoning: z.string()
    .describe('このアクションを選んだ理由（日本語で簡潔に）'),
});

export type CPUAction = z.infer<typeof ActionSchema>;
```

---

## 4. クラス実装

### 4.1 LLMProvider

```typescript
// apps/server/src/cpu/LLMProvider.ts
import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { ollama } from 'ollama-ai-provider';
import type { z } from 'zod';

export type LLMProviderType = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
  provider: LLMProviderType;
  model: string;
  temperature?: number;
}

export class LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private getModel() {
    switch (this.config.provider) {
      case 'openai':
        return openai(this.config.model);
      case 'anthropic':
        return anthropic(this.config.model);
      case 'ollama':
        return ollama(this.config.model);
    }
  }

  async generateAction<T extends z.ZodType>(
    prompt: string,
    schema: T
  ): Promise<z.infer<T>> {
    const result = await generateText({
      model: this.getModel(),
      prompt,
      temperature: this.config.temperature ?? 0.7,
      output: Output.object({ schema }),
    });
    return result.object;
  }
}
```

### 4.2 CPUPlayerService

```typescript
// apps/server/src/cpu/CPUPlayerService.ts
import type { GameState, Player } from '@dobon-uno/shared';
import { LLMProvider } from './LLMProvider';
import { RuleBasedCPU } from './RuleBasedCPU';
import { ActionSchema, type CPUAction } from './schemas/actionSchema';
import { formatGameStateForLLM } from './prompts/gameStateFormatter';
import { SYSTEM_PROMPT } from './prompts/systemPrompt';

export class CPUPlayerService {
  private llmProvider: LLMProvider;
  private ruleBasedCPU: RuleBasedCPU;
  private thinkingDelay: number;

  constructor(llmProvider: LLMProvider, thinkingDelay = 1500) {
    this.llmProvider = llmProvider;
    this.ruleBasedCPU = new RuleBasedCPU();
    this.thinkingDelay = thinkingDelay;
  }

  async decideAction(
    gameState: GameState,
    player: Player
  ): Promise<CPUAction> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(gameState, player);
      const action = await this.llmProvider.generateAction(prompt, ActionSchema);

      // 最低限の思考時間を確保（人間らしさのため）
      const elapsed = Date.now() - startTime;
      if (elapsed < this.thinkingDelay) {
        await this.delay(this.thinkingDelay - elapsed);
      }

      return action;
    } catch (error) {
      console.error('LLM error, falling back to rule-based:', error);
      return this.ruleBasedCPU.decideAction(gameState, player);
    }
  }

  private buildPrompt(gameState: GameState, player: Player): string {
    const gameContext = formatGameStateForLLM(gameState, player);
    return `${SYSTEM_PROMPT}\n\n${gameContext}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4.3 RuleBasedCPU（フォールバック）

```typescript
// apps/server/src/cpu/RuleBasedCPU.ts
import type { GameState, Player, Card } from '@dobon-uno/shared';
import type { CPUAction } from './schemas/actionSchema';

export class RuleBasedCPU {
  decideAction(gameState: GameState, player: Player): CPUAction {
    // 1. ドボンできるならドボン
    if (player.canDobon) {
      return { action: 'dobon', reasoning: 'ドボン可能' };
    }

    // 2. ドボン返しできるならドボン返し
    if (player.canDobonReturn) {
      return { action: 'dobonReturn', reasoning: 'ドボン返し可能' };
    }

    // 3. 色選択が必要なら手札に多い色を選ぶ
    if (player.canChooseColor) {
      const color = this.selectBestColor(player);
      return { action: 'chooseColor', color, reasoning: `手札に${color}が多い` };
    }

    // 4. 出せるカードがあれば出す（点数の高いものから）
    if (player.canPlay) {
      const playable = this.getPlayableCards(player);
      if (playable.length > 0) {
        const best = this.selectBestCard(playable);
        return { action: 'playCard', cardIds: [best.id], reasoning: '高得点カードを出す' };
      }
    }

    // 5. ドロースタックを引く
    if (player.canDrawStack) {
      return { action: 'drawStack', reasoning: '累積カードを引く' };
    }

    // 6. ドローできるならドロー
    if (player.canDraw) {
      return { action: 'draw', reasoning: 'カードを引く' };
    }

    // 7. パス
    return { action: 'pass', reasoning: 'パス' };
  }

  private getPlayableCards(player: Player): Card[] {
    const playable: Card[] = [];
    for (const card of player.myHand) {
      if (player.playableCards.get(card.id)) {
        playable.push(card);
      }
    }
    return playable;
  }

  private selectBestCard(cards: Card[]): Card {
    // 点数の高いカードを優先
    return cards.reduce((best, card) =>
      (card.score || 0) > (best.score || 0) ? card : best
    );
  }

  private selectBestColor(player: Player): 'red' | 'blue' | 'green' | 'yellow' {
    const colorCount: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const card of player.myHand) {
      if (card.color && card.color in colorCount) {
        colorCount[card.color]++;
      }
    }
    return Object.entries(colorCount).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0] as 'red' | 'blue' | 'green' | 'yellow';
  }
}
```

---

## 5. プロンプト設計

### 5.1 システムプロンプト

```typescript
// apps/server/src/cpu/prompts/systemPrompt.ts
export const SYSTEM_PROMPT = `あなたはUNOゲームのCPUプレイヤーです。
ゲームの状況を分析し、最適なアクションを決定してください。

## ゲームルール概要
- 場のカードと色・数字・記号のいずれかが一致するカードを出せる
- ワイルドカードと強制色変えカードはいつでも出せる
- 同じカード（色と数字/記号が完全一致）は複数枚同時に出せる（重ね出し）
- ドロー2にはドロー2またはドロー4を重ねられる
- ドロー4にはドロー4のみ重ねられる
- 記号カード（スキップ、リバース、ドロー2、ワイルド、ドロー4、強制色変え）では上がれない
- 数字カードの重ね出しでは上がれる
- ドボン: 出されたカードの点数と手札の合計点数が一致すれば宣言できる

## 戦略のヒント
- 手札を減らすことを優先
- 相手の手札が少ない時はドロー系カードを温存
- ドボンの機会を逃さない
- 色選択時は手札に多い色を選ぶ

## 出力形式
指定されたJSON形式で、実行するアクションと理由を出力してください。
可能なアクションの中から必ず1つを選んでください。`;
```

### 5.2 ゲーム状態フォーマッター

```typescript
// apps/server/src/cpu/prompts/gameStateFormatter.ts
import type { GameState, Player, Card } from '@dobon-uno/shared';

export function formatGameStateForLLM(
  gameState: GameState,
  cpuPlayer: Player
): string {
  const lines: string[] = [];

  // 基本情報
  lines.push('## 現在のゲーム状況');
  lines.push(`- 現在の色: ${gameState.currentColor || '未設定'}`);
  lines.push(`- 場のカード: ${formatFieldCards(gameState.fieldCards)}`);
  lines.push(`- ドロー累積: ${gameState.drawStack}枚`);
  lines.push(`- 山札残り: ${gameState.deckCount}枚`);
  lines.push(`- 順番方向: ${gameState.turnDirection === 1 ? '時計回り' : '反時計回り'}`);

  // 自分の状態
  lines.push('');
  lines.push('## あなたの状態');
  lines.push(`- 手札: ${formatHand(cpuPlayer.myHand)}`);
  lines.push(`- 手札合計点数: ${calculateHandScore(cpuPlayer.myHand)}点`);

  // 可能なアクション
  lines.push('');
  lines.push('## 可能なアクション');
  if (cpuPlayer.canPlay) {
    const playableCards = getPlayableCards(cpuPlayer);
    lines.push(`- カードを出す (playCard): ${playableCards.join(', ')}`);
  }
  if (cpuPlayer.canDraw) lines.push('- 山札から引く (draw)');
  if (cpuPlayer.canDrawStack) lines.push(`- 累積${gameState.drawStack}枚を引く (drawStack)`);
  if (cpuPlayer.canPass) lines.push('- パス (pass)');
  if (cpuPlayer.canChooseColor) lines.push('- 色を選択 (chooseColor): red, blue, green, yellow');
  if (cpuPlayer.canDobon) lines.push('- ドボン宣言 (dobon)');
  if (cpuPlayer.canDobonReturn) lines.push('- ドボン返し (dobonReturn)');

  // 他プレイヤーの状態
  lines.push('');
  lines.push('## 他プレイヤーの状態');
  for (const [, player] of gameState.players) {
    if (player.sessionId !== cpuPlayer.sessionId && !player.isSpectator) {
      lines.push(`- ${player.name}: 手札${player.handCount}枚`);
    }
  }

  return lines.join('\n');
}

function formatFieldCards(fieldCards: Card[]): string {
  if (fieldCards.length === 0) return 'なし';
  const lastCard = fieldCards[fieldCards.length - 1];
  return `${lastCard.color || ''}${lastCard.type}${lastCard.number ?? ''}`;
}

function formatHand(hand: Card[]): string {
  return hand.map(card => {
    const color = card.color || '';
    const type = card.type;
    const number = card.number ?? '';
    return `${color}${type}${number}(ID:${card.id})`;
  }).join(', ');
}

function calculateHandScore(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + (card.score || 0), 0);
}

function getPlayableCards(player: Player): string[] {
  const playable: string[] = [];
  for (const card of player.myHand) {
    if (player.playableCards.get(card.id)) {
      playable.push(`${card.color || ''}${card.type}${card.number ?? ''}(ID:${card.id})`);
    }
  }
  return playable;
}
```

---

## 6. ゲームとの統合

### 6.1 Playerスキーマの拡張

```typescript
// packages/shared/src/schema/Player.ts（追加）
export class Player extends Schema {
  // ... 既存のプロパティ ...

  @type('boolean')
  isCPU: boolean = false;
}
```

### 6.2 GameRoomへの統合

```typescript
// apps/server/src/rooms/GameRoom.ts（追加部分）
import { CPUPlayerService } from '../cpu/CPUPlayerService';
import { LLMProvider } from '../cpu/LLMProvider';
import type { CPUAction } from '../cpu/schemas/actionSchema';

export class GameRoom extends Room<GameState> {
  private cpuService?: CPUPlayerService;
  private cpuPlayers: Map<string, Player> = new Map();

  onCreate(options: any) {
    // ... 既存のコード ...

    // CPU設定がある場合は初期化
    if (options.enableCPU) {
      const llmProvider = new LLMProvider({
        provider: process.env.LLM_PROVIDER || 'openai',
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
      });
      this.cpuService = new CPUPlayerService(llmProvider);
    }

    // CPUプレイヤー追加メッセージハンドラー
    this.onMessage('addCPU', (client, data: { name: string }) => {
      this.addCPUPlayer(data.name);
    });
  }

  // CPUプレイヤーを追加
  addCPUPlayer(name: string): Player {
    const sessionId = `cpu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const player = new Player();
    player.sessionId = sessionId;
    player.name = name;
    player.isCPU = true;

    this.state.players.set(sessionId, player);
    this.cpuPlayers.set(sessionId, player);

    return player;
  }

  // ターン変更時にCPUの行動をトリガー
  private async triggerCPUAction(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || !this.cpuPlayers.has(playerId) || !this.cpuService) {
      return;
    }

    try {
      const action = await this.cpuService.decideAction(this.state, player);
      await this.executeCPUAction(playerId, action);
    } catch (error) {
      console.error('CPU action error:', error);
    }
  }

  private async executeCPUAction(playerId: string, action: CPUAction) {
    console.log(`CPU ${playerId}:`, action.action, '-', action.reasoning);

    switch (action.action) {
      case 'playCard':
        if (action.cardIds) {
          this.dispatcher.dispatch(new PlayCardCommand(), {
            sessionId: playerId,
            cardIds: action.cardIds,
          });
        }
        break;
      case 'draw':
        this.dispatcher.dispatch(new DrawCardCommand(), { sessionId: playerId });
        break;
      case 'drawStack':
        this.dispatcher.dispatch(new DrawStackCommand(), { sessionId: playerId });
        break;
      case 'pass':
        this.dispatcher.dispatch(new PassCommand(), { sessionId: playerId });
        break;
      case 'chooseColor':
        if (action.color) {
          this.dispatcher.dispatch(new ChooseColorCommand(), {
            sessionId: playerId,
            color: action.color,
          });
        }
        break;
      case 'dobon':
        this.dispatcher.dispatch(new DobonCommand(), { sessionId: playerId });
        break;
      case 'dobonReturn':
        this.dispatcher.dispatch(new DobonReturnCommand(), { sessionId: playerId });
        break;
    }
  }
}
```

---

## 7. 設定

### 7.1 環境変数

```bash
# .env
# LLM設定
LLM_PROVIDER=openai    # openai | anthropic | ollama
LLM_MODEL=gpt-4o-mini

# OpenAI
OPENAI_API_KEY=sk-xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Ollama（ローカル）
OLLAMA_BASE_URL=http://localhost:11434
```

### 7.2 CPU難易度設定

```typescript
// apps/server/src/cpu/config.ts
export interface CPUDifficulty {
  name: string;
  model: string;
  thinkingDelay: number;
  temperature: number;
}

export const CPU_DIFFICULTIES: Record<string, CPUDifficulty> = {
  easy: {
    name: '初級',
    model: 'gpt-4o-mini',
    thinkingDelay: 1000,
    temperature: 1.0,
  },
  normal: {
    name: '中級',
    model: 'gpt-4o-mini',
    thinkingDelay: 1500,
    temperature: 0.7,
  },
  hard: {
    name: '上級',
    model: 'gpt-4o',
    thinkingDelay: 2000,
    temperature: 0.3,
  },
};
```

### 7.3 依存パッケージ

```bash
# apps/serverに追加
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic ollama-ai-provider zod
```

---

## 8. 対応LLMモデル

### クラウドAPI

| プロバイダー | モデル | 特徴 |
|------------|-------|------|
| **OpenAI** | gpt-4o-mini | コスパ良好、高速 |
| **OpenAI** | gpt-4o | 高精度 |
| **Anthropic** | claude-3-5-haiku | 高速、低コスト |
| **Anthropic** | claude-3-5-sonnet | バランス良好 |

### ローカルLLM（Ollama）

```typescript
import { ollama } from 'ollama-ai-provider';

const result = await generateText({
  model: ollama('llama3.2'),
  // ...
});
```

**推奨ローカルモデル**:
- `llama3.2` - Meta製、バランス良好
- `qwen2.5` - 推論能力が高い
- `mistral` - 軽量で高速

---

## 参考リンク

- [Vercel AI SDK](https://ai-sdk.dev/)
- [AI SDK 構造化出力](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Ollama AI Provider](https://ai-sdk.dev/providers/community-providers/ollama)
