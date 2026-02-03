import { openai } from "@ai-sdk/openai";
import type { GameState, Player } from "@dobon-uno/shared";
import { generateText } from "ai";
import { cpuTools } from "./tools";

export interface CPUDecision {
  action: string;
  params?: Record<string, unknown>;
}

export class CPUActionDecider {
  private model = openai("gpt-4o-mini");

  async decide(state: GameState, cpuPlayer: Player): Promise<CPUDecision> {
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
    const playableCardIds: string[] = [];
    cpuPlayer.playableCards.forEach((canPlay, cardId) => {
      if (canPlay) {
        playableCardIds.push(cardId);
      }
    });

    const otherPlayers: string[] = [];
    state.players.forEach((p) => {
      if (p.sessionId !== cpuPlayer.sessionId && !p.isSpectator) {
        otherPlayers.push(
          `- ${p.name}: 手札${p.handCount}枚, カードを引いた: ${p.hasDrawnCard ? "はい" : "いいえ"}`,
        );
      }
    });

    const handInfo = cpuPlayer.myHand
      .map(
        (c) => `- ${c.id} (色: ${c.color}, 値: ${c.value}, 点数: ${c.points})`,
      )
      .join("\n");

    return `
## 現在のゲーム状態

### 場の状況
- 場のカード: ${fieldCard.id} (色: ${fieldCard.color}, 値: ${fieldCard.value}, 点数: ${fieldCard.points})
- 現在有効な色: ${state.currentColor}
- 累積ドロー: ${state.drawStack}枚
- ターン方向: ${state.turnDirection === 1 ? "時計回り" : "反時計回り"}
- 山札残り: ${state.deckCount}枚

### あなたの手札
${handInfo}

### 出せるカード
${playableCardIds.length > 0 ? playableCardIds.join(", ") : "なし"}

### 可能なアクション
- カードを出す: ${playableCardIds.length > 0 ? "可能" : "不可"}
- 山札を引く: ${cpuPlayer.canDraw ? "可能" : "不可"}
- 累積を引く: ${cpuPlayer.canDrawStack ? "可能" : "不可"}
- パス: ${cpuPlayer.canPass ? "可能" : "不可"}
- ドボン: ${cpuPlayer.canDobon ? "可能" : "不可"}
- ドボン返し: ${cpuPlayer.canDobonReturn ? "可能" : "不可"}
- 色選択: ${cpuPlayer.canChooseColor ? "必要" : "不要"}

### 他のプレイヤーの状況
${otherPlayers.join("\n")}

最適なアクションを1つ選んでください。
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
