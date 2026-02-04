import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { groq } from "@ai-sdk/groq";
import type { GameState, Player } from "@dobon-uno/shared";
import { generateText } from "ai";
import { cpuTools } from "./tools";

export interface CPUDecision {
  action: string;
  params?: unknown;
}

interface CPULog {
  timestamp: string;
  cpuName: string;
  systemPrompt: string;
  userPrompt: string;
  reasoning: string;
  toolCall: {
    name: string;
    input: unknown;
  };
  usage?: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
  };
}

export class CPUActionDecider {
  private model = groq("llama-3.1-8b-instant");
  private logDir = join(process.cwd(), "logs", "cpu");

  constructor() {
    // ログディレクトリを作成
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  async decide(state: GameState, cpuPlayer: Player): Promise<CPUDecision> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildContext(state, cpuPlayer);
    const availableTools = this.filterAvailableTools(cpuPlayer);

    const result = await generateText({
      model: this.model,
      tools: availableTools,
      toolChoice: "required", // 必ずツールを呼び出す
      temperature: 0.3, // 少しだけ創造性を持たせる
      maxOutputTokens: 500, // 思考過程を含むため増加
      system: systemPrompt,
      prompt: userPrompt,
    });

    // ツール呼び出し結果を解析
    const toolCall = result.toolCalls[0];
    const decision: CPUDecision = {
      action: toolCall.toolName,
      params: toolCall.input,
    };

    // ログを書き出し
    this.writeLog({
      timestamp: new Date().toISOString(),
      cpuName: cpuPlayer.name,
      systemPrompt,
      userPrompt,
      reasoning: result.text || "(no reasoning)",
      toolCall: {
        name: toolCall.toolName,
        input: toolCall.input,
      },
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    });

    return decision;
  }

  private writeLog(log: CPULog): void {
    try {
      const filename = `${log.timestamp.replace(/[:.]/g, "-")}_${log.cpuName}.json`;
      const filepath = join(this.logDir, filename);
      writeFileSync(filepath, JSON.stringify(log, null, 2), "utf-8");
      console.log(`[CPU] Log written: ${filepath}`);
    } catch (error) {
      console.error("[CPU] Failed to write log:", error);
    }
  }

  private buildContext(state: GameState, cpuPlayer: Player): string {
    const fieldCard = state.fieldCards[state.fieldCards.length - 1];

    // 出せるカードと出せないカードを分類
    const playableCards: string[] = [];
    const unplayableCards: string[] = [];
    for (const card of cpuPlayer.myHand) {
      const canPlay = cpuPlayer.playableCards.get(card.id);
      const cardInfo = `${card.id} (色: ${card.color}, 値: ${card.value}, 点数: ${card.points})`;
      if (canPlay) {
        playableCards.push(cardInfo);
      } else {
        unplayableCards.push(cardInfo);
      }
    }

    const otherPlayers: string[] = [];
    state.players.forEach((p) => {
      if (p.sessionId !== cpuPlayer.sessionId && !p.isSpectator) {
        otherPlayers.push(
          `- ${p.name}: 手札${p.handCount}枚, カードを引いた: ${p.hasDrawnCard ? "はい" : "いいえ"}`,
        );
      }
    });

    // 手札の合計点数を計算
    const totalPoints = cpuPlayer.myHand.reduce((sum, c) => sum + c.points, 0);

    // 出せるカードのIDリスト（playCardで使用）
    const playableCardIds = playableCards.map((c) => c.split(" ")[0]);

    return `
## 現在のゲーム状態

### 場の状況
- 場のカード: ${fieldCard.id} (色: ${fieldCard.color}, 値: ${fieldCard.value}, 点数: ${fieldCard.points})
- 現在有効な色: ${state.currentColor}
- 累積ドロー: ${state.drawStack}枚

### あなたの手札（合計${totalPoints}点）

**★★★ 出せるカード（この中からのみ選択可能）★★★**
${playableCards.length > 0 ? playableCards.map((c) => `- ${c}`).join("\n") : "- なし"}

**出せないカード（選択禁止）**
${unplayableCards.length > 0 ? unplayableCards.map((c) => `- ${c}`).join("\n") : "- なし"}

### 可能なアクション
- playCard: ${playableCards.length > 0 ? `可能（cardIds: ${playableCardIds.join(", ")} のみ使用可）` : "不可"}
- drawCard: ${cpuPlayer.canDraw ? "可能" : "不可"}
- drawStack: ${cpuPlayer.canDrawStack ? "可能" : "不可"}
- pass: ${cpuPlayer.canPass ? "可能" : "不可"}
- dobon: ${cpuPlayer.canDobon ? "可能" : "不可"}
- dobonReturn: ${cpuPlayer.canDobonReturn ? "可能" : "不可"}
- chooseColor: ${cpuPlayer.canChooseColor ? "必要" : "不要"}

### 他のプレイヤーの状況
${otherPlayers.join("\n")}

**重要**: playCardを選ぶ場合、cardIdsには「出せるカード」のIDのみを指定してください。出せないカードのIDを指定するとエラーになります。
`;
  }

  private filterAvailableTools(
    player: Player,
  ): Record<string, (typeof cpuTools)[keyof typeof cpuTools]> {
    const available: Record<string, (typeof cpuTools)[keyof typeof cpuTools]> =
      {};

    // 出せるカードがある場合
    let hasPlayableCards = false;
    player.playableCards.forEach((canPlay) => {
      if (canPlay) hasPlayableCards = true;
    });
    if (hasPlayableCards) {
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

## 思考の手順

アクションを選ぶ前に、必ず以下の手順で思考してください：

1. **状況の確認**: 場のカード、自分の手札、出せるカードを確認
2. **特殊アクションの確認**: ドボン・ドボン返しができるか確認（できるなら最優先）
3. **相手の状況分析**: 相手の手札枚数と「カードを引いた」状態を確認
4. **危険度の評価**: 出すカードが相手にドボンされやすい点数になるか評価
5. **最適なアクションの決定**: 上記を踏まえて最適なアクションを選択

## 基本戦略

### 最優先アクション（この順番で確認し、該当するものを必ず実行）
1. **色選択が必要な場合は必ずchooseColorを実行する**（他のアクションは選べない）
2. ドボンできる場合は必ずdobonを実行する
3. ドボン返しができる場合は必ずdobonReturnを実行する

### 通常プレイ
- 基本的に自分は上がりに向かう
- 出せるカードがある場合は基本的に出す
- 自分の手札合計が20点でも、山札を引かずにカードを出す
- 手札合計を「0〜9、10、20、30、50」のいずれかぴったりにすることを目指す（ドボン返し可能状態）
- 例: 手札が1,2,8,+2,+2の場合、1を出して残り2+8+20+20=50にする
- 記号カード（Skip, Reverse, Draw2, Wild, Draw4）は優先して早めに切る

### ドボンへの警戒（相手にドボンされないためのルール）

**重要: 相手の「カードを引いた」が「はい」の場合は、ドボンを全く警戒しなくてよい。**
（カードを引いた直後は手札の合計点数が変わっているため、ドボンの危険性は低い）

相手の手札枚数によって「危険な点数」が異なる（「カードを引いた」が「いいえ」の場合）：
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

### 色選択（chooseColorが「必要」の場合）
**chooseColorが「必要」と表示されている場合、必ずchooseColorアクションを実行すること。**
他のアクション（playCard, drawCard等）は選択できない。
色の選び方：
- 手札に最も多い色を選ぶ
- または、次に出したいカードの色を選ぶ
- ドボン返しを狙える記号カードがある場合は、その色を選ぶ

## 重ね出しルール
- 同じ数字のカードは複数枚同時に出せる
- 重ね出しすると手札を早く減らせて有利

## ★★★ 最重要ルール ★★★

**1. chooseColorが「必要」の場合、必ずchooseColorを実行すること**
- 色選択が必要な状態では、他のアクションは実行できない
- red, blue, green, yellow のいずれかを選択する

**2. playCardを使う場合、cardIdsには「出せるカード」のIDのみを指定すること**
- 「出せないカード」に分類されているカードのIDは絶対に指定しないこと
- 指定できるカードIDは「出せるカード」セクションに記載されたもののみ
- 違反するとゲームエラーになる

## その他の注意事項
- 必ず1つのアクションを選択すること
`;
  }
}
