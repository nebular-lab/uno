# LLM CPU プレイヤー設計書

UNOゲームにLLM（大規模言語モデル）を使用したCPUプレイヤーを追加するための技術選定と設計ドキュメント。

---

## 1. 技術選定

### 候補ライブラリの比較

| ライブラリ | 構造化出力 | TypeScript対応 | モデル対応 | 特徴 |
|-----------|----------|--------------|----------|------|
| **Vercel AI SDK** | ◎ | ◎ | OpenAI, Anthropic, Google, Ollama | 最も活発な開発、Zod統合が優秀 |
| **OpenCode SDK** | ○ | ◎ | 75+プロバイダー（OpenCode経由） | OpenCodeサーバー経由、間接的なLLMアクセス |
| **LangChain.js** | ○ | ○ | 多数 | 機能豊富だが複雑 |
| **Instructor-JS** | ◎ | ◎ | OpenAI, Anthropic, Ollama | シンプルで構造化出力に特化 |

### 1.1 Vercel AI SDK

**公式サイト**: https://ai-sdk.dev/

#### 特徴
- `generateText`/`streamText` に `output` プロパティで構造化出力を指定
- Zodスキーマによる型安全な出力
- AI SDK 6で `Output.object()` APIが追加され、ツール呼び出しと構造化出力の統合が可能
- OllamaプロバイダーでローカルLLMにも対応

#### コード例
```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'ゲームの状況を分析して次のアクションを決定してください',
  output: Output.object({
    schema: z.object({
      action: z.enum(['playCard', 'draw', 'pass', 'dobon']),
      cardIds: z.array(z.string()).optional(),
      color: z.enum(['red', 'blue', 'green', 'yellow']).optional(),
      reasoning: z.string(),
    }),
  }),
});
```

### 1.2 OpenCode SDK

**公式サイト**: https://opencode.ai/docs/sdk/

#### 概要
OpenCode SDKは、**OpenCodeサーバー**（AIコーディングエージェント）と通信するためのTypeScriptクライアントです。
LLMプロバイダーと直接通信するVercel AI SDKとは異なり、OpenCodeサーバーを介してAI機能にアクセスします。

#### 特徴
- OpenCodeサーバー経由で75以上のLLMプロバイダーに対応
- TypeScript型定義が完備（OpenAPI仕様から自動生成）
- セッション管理、ストリーミングレスポンス対応
- 構造化出力は `StructuredOutput` ツール注入方式で実現

#### アーキテクチャの違い

```
[Vercel AI SDK]
  アプリ → AI SDK → LLMプロバイダー（直接通信）

[OpenCode SDK]
  アプリ → OpenCode SDK → OpenCodeサーバー → LLMプロバイダー
```

#### コード例
```typescript
import Opencode from '@opencode-ai/sdk';

const client = new Opencode();

// セッションを作成してメッセージを送信
const session = await client.session.create();
const response = await client.chat.send({
  sessionId: session.id,
  message: 'ゲームの状況を分析して次のアクションを決定してください',
});
```

#### Vercel AI SDK との比較

| 観点 | Vercel AI SDK | OpenCode SDK |
|------|--------------|--------------|
| **通信方式** | LLMプロバイダーと直接通信 | OpenCodeサーバー経由 |
| **依存関係** | なし（スタンドアロン） | OpenCodeサーバーが必要 |
| **構造化出力** | `Output.object()` で直接サポート | StructuredOutputツール注入 |
| **セットアップ** | APIキー設定のみ | サーバー起動 + SDK設定 |
| **ユースケース** | アプリ組み込み向け | 開発ツール/CLI向け |
| **レイテンシ** | 低（直接通信） | やや高（サーバー経由） |

#### 本プロジェクトでの評価

**不採用の理由:**
1. **追加の依存関係**: OpenCodeサーバーの起動・管理が必要
2. **オーバーヘッド**: サーバー経由のため、レイテンシが増加
3. **ユースケースの不一致**: OpenCodeは開発支援ツール向けで、ゲームCPUのような組み込み用途には適さない
4. **構造化出力の成熟度**: Vercel AI SDKの方がZod統合が洗練されている

OpenCode SDKは開発支援ツールとしては優秀ですが、**ゲームサーバーに組み込むLLM呼び出し**にはVercel AI SDKの直接通信の方が適しています。

---

### 1.3 LangChain.js

**公式サイト**: https://js.langchain.com/

#### 特徴
- `withStructuredOutput` メソッドでZodスキーマを接続
- エージェント機能が豊富
- 多くのモデルプロバイダーに対応

#### コード例
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
const structuredModel = model.withStructuredOutput(
  z.object({
    action: z.enum(['playCard', 'draw', 'pass', 'dobon']),
    cardIds: z.array(z.string()).optional(),
  })
);

const result = await structuredModel.invoke('次のアクションを決定');
```

### 1.4 Instructor-JS

**公式サイト**: https://js.useinstructor.com/

#### 特徴
- 構造化出力に特化したシンプルなライブラリ
- 自動リトライ機能（出力が不正な場合の自己修正）
- OpenAI Tool Callingを内部で活用

#### コード例
```typescript
import Instructor from '@instructor-ai/instructor';
import OpenAI from 'openai';
import { z } from 'zod';

const client = Instructor({ client: new OpenAI() });

const result = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  response_model: {
    schema: z.object({
      action: z.enum(['playCard', 'draw', 'pass', 'dobon']),
      cardIds: z.array(z.string()).optional(),
    }),
    name: 'UnoAction',
  },
  messages: [{ role: 'user', content: 'ゲームの状況...' }],
});
```

### 推奨: Vercel AI SDK

以下の理由から **Vercel AI SDK** を推奨：

1. **活発な開発**: AI SDK 6で大幅な機能強化
2. **型安全性**: TypeScript + Zodによる完全な型推論
3. **マルチプロバイダー**: OpenAI、Anthropic、Ollamaなど幅広く対応
4. **サーバーサイド最適化**: Node.js環境での使用に最適化
5. **シンプルなAPI**: generateText一つで構造化出力が可能

---

## 2. 対応LLMモデル

### 2.1 クラウドAPI

| プロバイダー | モデル | 特徴 |
|------------|-------|------|
| **OpenAI** | gpt-4o-mini | コスパ良好、高速 |
| **OpenAI** | gpt-4o | 高精度 |
| **Anthropic** | claude-3-5-haiku | 高速、低コスト |
| **Anthropic** | claude-3-5-sonnet | バランス良好 |
| **Google** | gemini-2.0-flash | 高速 |

### 2.2 ローカルLLM（Ollama）

Ollamaを使用することで、APIコストなしでローカル環境でLLMを実行可能。

```typescript
import { ollama } from 'ollama-ai-provider';

const result = await generateText({
  model: ollama('llama3.2'),
  // ...
});
```

**推奨モデル**（2026年時点）:
- `llama3.2` - Meta製、バランス良好
- `qwen2.5` - 推論能力が高い
- `mistral` - 軽量で高速

---

## 3. アーキテクチャ設計

### 3.1 全体構成

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

### 3.2 ディレクトリ構成

```
apps/server/src/
├── cpu/
│   ├── LLMProvider.ts         # LLM API抽象化
│   ├── CPUPlayerService.ts    # CPUプレイヤー管理
│   ├── prompts/
│   │   ├── systemPrompt.ts    # システムプロンプト
│   │   └── gameStateFormatter.ts  # ゲーム状態のフォーマット
│   └── schemas/
│       └── actionSchema.ts    # アクション出力スキーマ
├── services/
│   └── ...
└── ...
```

### 3.3 クラス設計

#### LLMProvider

LLM APIの抽象化レイヤー。プロバイダー切り替えを容易にする。

```typescript
// apps/server/src/cpu/LLMProvider.ts
import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { ollama } from 'ollama-ai-provider';
import { z } from 'zod';

export type LLMProviderType = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string; // Ollama用
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
      output: Output.object({ schema }),
    });
    return result.object;
  }
}
```

#### CPUPlayerService

CPUプレイヤーのゲームロジックを管理。

```typescript
// apps/server/src/cpu/CPUPlayerService.ts
import type { GameState, Player } from '@dobon-uno/shared';
import { LLMProvider } from './LLMProvider';
import { ActionSchema, type CPUAction } from './schemas/actionSchema';
import { formatGameStateForLLM } from './prompts/gameStateFormatter';
import { SYSTEM_PROMPT } from './prompts/systemPrompt';

export class CPUPlayerService {
  private llmProvider: LLMProvider;
  private thinkingDelay: number;

  constructor(llmProvider: LLMProvider, thinkingDelay = 1500) {
    this.llmProvider = llmProvider;
    this.thinkingDelay = thinkingDelay;
  }

  async decideAction(
    gameState: GameState,
    player: Player
  ): Promise<CPUAction> {
    const prompt = this.buildPrompt(gameState, player);

    // LLMに問い合わせ
    const action = await this.llmProvider.generateAction(prompt, ActionSchema);

    // 人間らしい遅延を追加
    await this.delay(this.thinkingDelay);

    return action;
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

---

## 4. 出力スキーマ定義

### 4.1 アクションスキーマ

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

### 4.2 色選択スキーマ（別途必要な場合）

```typescript
// apps/server/src/cpu/schemas/colorChoiceSchema.ts
import { z } from 'zod';

export const ColorChoiceSchema = z.object({
  color: z.enum(['red', 'blue', 'green', 'yellow'])
    .describe('選択する色'),
  reasoning: z.string()
    .describe('この色を選んだ理由'),
});

export type ColorChoice = z.infer<typeof ColorChoiceSchema>;
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
指定されたJSON形式で、実行するアクションと理由を出力してください。`;
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
    lines.push(`- カードを出す: ${playableCards.join(', ')}`);
  }
  if (cpuPlayer.canDraw) lines.push('- 山札から引く (draw)');
  if (cpuPlayer.canDrawStack) lines.push(`- 累積${gameState.drawStack}枚を引く (drawStack)`);
  if (cpuPlayer.canPass) lines.push('- パス (pass)');
  if (cpuPlayer.canChooseColor) lines.push('- 色を選択 (chooseColor)');
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

### 6.1 GameRoomへの統合

```typescript
// apps/server/src/rooms/GameRoom.ts（追加部分）
import { CPUPlayerService } from '../cpu/CPUPlayerService';
import { LLMProvider } from '../cpu/LLMProvider';

export class GameRoom extends Room<GameState> {
  private cpuService?: CPUPlayerService;
  private cpuPlayers: Map<string, Player> = new Map();

  onCreate(options: any) {
    // ... 既存のコード ...

    // CPU設定がある場合は初期化
    if (options.enableCPU) {
      const llmProvider = new LLMProvider({
        provider: options.llmProvider || 'openai',
        model: options.llmModel || 'gpt-4o-mini',
      });
      this.cpuService = new CPUPlayerService(llmProvider);
    }
  }

  // CPUプレイヤーを追加
  addCPUPlayer(name: string): Player {
    const sessionId = `cpu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const player = new Player();
    player.sessionId = sessionId;
    player.name = name;
    player.isCPU = true; // Playerスキーマに追加が必要

    this.state.players.set(sessionId, player);
    this.cpuPlayers.set(sessionId, player);

    return player;
  }

  // ターン変更時にCPUの行動をトリガー
  private async onTurnChange(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || !this.cpuPlayers.has(playerId) || !this.cpuService) {
      return;
    }

    try {
      const action = await this.cpuService.decideAction(this.state, player);
      await this.executeCPUAction(playerId, action);
    } catch (error) {
      console.error('CPU action error:', error);
      // フォールバック: ドローしてパス
      await this.executeFallbackAction(playerId);
    }
  }

  private async executeCPUAction(playerId: string, action: CPUAction) {
    console.log(`CPU ${playerId} action:`, action.action, action.reasoning);

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

### 6.2 Playerスキーマの拡張

```typescript
// packages/shared/src/schema/Player.ts（追加）
export class Player extends Schema {
  // ... 既存のプロパティ ...

  @type('boolean')
  isCPU: boolean = false;
}
```

---

## 7. 設定とオプション

### 7.1 環境変数

```bash
# .env
# OpenAI
OPENAI_API_KEY=sk-xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Ollama（ローカル）
OLLAMA_BASE_URL=http://localhost:11434

# デフォルトプロバイダー
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

### 7.2 CPU難易度設定

```typescript
export interface CPUDifficulty {
  name: string;
  model: string;
  thinkingDelay: number;  // 思考時間（ms）
  temperature: number;     // LLMのtemperature
}

export const CPU_DIFFICULTIES: Record<string, CPUDifficulty> = {
  easy: {
    name: '初級',
    model: 'gpt-4o-mini',
    thinkingDelay: 1000,
    temperature: 1.0, // ランダム性高め
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
    temperature: 0.3, // より最適な判断
  },
};
```

---

## 8. 依存パッケージ

```bash
# apps/serverに追加
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic ollama-ai-provider zod
```

---

## 9. 今後の拡張

### 9.1 検討事項

1. **キャッシュ**: 類似の状況での判断をキャッシュしてAPI呼び出しを削減
2. **バッチ処理**: 複数CPUの判断を並列実行
3. **学習機能**: 過去のゲーム結果を元にプロンプトを調整
4. **ストリーミング**: 思考過程をリアルタイムで表示（演出用）

### 9.2 非LLM代替

LLM APIが利用できない場合のフォールバックとして、ルールベースのシンプルなCPUも実装可能：

```typescript
// apps/server/src/cpu/RuleBasedCPU.ts
export class RuleBasedCPU {
  decideAction(gameState: GameState, player: Player): CPUAction {
    // 1. ドボンできるならドボン
    if (player.canDobon) {
      return { action: 'dobon', reasoning: 'ドボン可能' };
    }

    // 2. 出せるカードがあれば出す（点数の高いものから）
    const playable = this.getPlayableCards(player);
    if (playable.length > 0) {
      const best = this.selectBestCard(playable);
      return { action: 'playCard', cardIds: [best.id], reasoning: '出せるカードを出す' };
    }

    // 3. ドローできるならドロー
    if (player.canDraw) {
      return { action: 'draw', reasoning: 'カードを引く' };
    }

    // 4. パス
    return { action: 'pass', reasoning: 'パス' };
  }
}
```

---

## 参考リンク

- [Vercel AI SDK](https://ai-sdk.dev/)
- [AI SDK 6 リリースノート](https://vercel.com/blog/ai-sdk-6)
- [AI SDK 構造化出力](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Ollama AI Provider](https://ai-sdk.dev/providers/community-providers/ollama)
- [OpenCode SDK](https://opencode.ai/docs/sdk/)
- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [LangChain.js](https://js.langchain.com/)
- [Instructor-JS](https://js.useinstructor.com/)
