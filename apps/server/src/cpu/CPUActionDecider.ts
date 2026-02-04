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

## 1. 必ず守るべき事項

- **chooseColorが「必要」の場合**: 必ずchooseColorを実行（他のアクションは不可）
- **playCard**: 「出せるカード」のIDのみ指定可能。出せないカードのIDは絶対NG

## 2. 基本戦略

**優先順位**:
1. ドボン/ドボン返しができるなら即実行
2. 出せるカードがあれば出す（手札を減らす）
3. 記号カード（Skip, Reverse, Draw2等）は早めに切る
4. 手札合計を0〜9, 10, 20, 30, 50点に調整（ドボン返し準備）

**色選択**: 手札に多い色、または次に出したいカードの色を選ぶ

## 3. リスクとリターンの判断

**リスク（相手にドボンされる危険）**:
- 相手が「カードを引いた: いいえ」の場合のみ警戒
- 手札1〜4枚 → 20点を警戒
- 手札4〜7枚 → 30, 50点も警戒
- 自分の手札が多いほど、ドボンされた時のダメージ大

**リターン（攻めるべき場面）**:
- 自分の手札が少ない → 積極的に出して上がりを目指す
- 手札合計がドボン可能点数 → ドボン返し狙いで攻める
- 場が安全な点数（0〜9, 10, 20, 30, 50）になるカード → 出してOK

**判断**: 手札が多いなら守り重視、少ないなら攻め重視
`;
  }
}
