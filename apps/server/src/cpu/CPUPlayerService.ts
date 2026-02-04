import type { Dispatcher } from "@colyseus/command";
import type { GameState, Player } from "@dobon-uno/shared";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
import { PlayCardCommand } from "../commands/PlayCardCommand";
import type { GameRoom } from "../rooms/GameRoom";
import { CPUActionDecider, type CPUDecision } from "./CPUActionDecider";

// 型ガード: paramsがオブジェクトかどうか
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// paramsから文字列を取得
function getString(params: unknown, key: string): string | undefined {
  if (!isObject(params)) return undefined;
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export class CPUPlayerService {
  private decider = new CPUActionDecider();
  private thinkingDelay = 1000; // 思考時間の演出（ms）
  private quickActionDelay = 200; // 即決アクションの遅延（ms）
  private dobonReturnDelay = 3000; // ドボン返しの遅延（ms）

  async handleTurn(
    state: GameState,
    cpuPlayer: Player,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    // CPUプレイヤーでない場合は何もしない
    if (!cpuPlayer.isCpu) return;

    // ドボン返しが可能な場合は3秒後に実行（LLM不要）
    if (cpuPlayer.canDobonReturn) {
      await this.delay(this.dobonReturnDelay);
      await dispatcher.dispatch(new DobonReturnCommand(), {
        sessionId: cpuPlayer.sessionId,
      });
      return;
    }

    // ドボンが可能な場合は即座に実行（LLM不要）
    if (cpuPlayer.canDobon) {
      await this.delay(this.quickActionDelay);
      await dispatcher.dispatch(new DobonCommand(), {
        sessionId: cpuPlayer.sessionId,
      });
      return;
    }

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
    decision: CPUDecision,
    sessionId: string,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    switch (decision.action) {
      case "playCard": {
        const cardId = getString(decision.params, "cardId");
        if (cardId) {
          await dispatcher.dispatch(new PlayCardCommand(), {
            sessionId,
            cardIds: [cardId],
          });
        }
        break;
      }

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

      case "dobonReturn":
        await dispatcher.dispatch(new DobonReturnCommand(), {
          sessionId,
        });
        break;

      case "chooseColor": {
        const color = getString(decision.params, "color") ?? "red";
        await dispatcher.dispatch(new ChooseColorCommand(), {
          sessionId,
          color,
        });
        break;
      }

      default:
        console.warn(`Unknown CPU action: ${decision.action}`);
    }
  }

  private async executeFallbackAction(
    player: Player,
    dispatcher: Dispatcher<GameRoom>,
  ): Promise<void> {
    // 優先順位: ドボン返し > ドボン > 色選択 > カード出す > 累積引く > 山札引く > パス
    if (player.canDobonReturn) {
      await dispatcher.dispatch(new DobonReturnCommand(), {
        sessionId: player.sessionId,
      });
    } else if (player.canDobon) {
      await dispatcher.dispatch(new DobonCommand(), {
        sessionId: player.sessionId,
      });
    } else if (player.canChooseColor) {
      // 手札に最も多い色を選ぶ
      const color = this.getMostCommonColor(player);
      await dispatcher.dispatch(new ChooseColorCommand(), {
        sessionId: player.sessionId,
        color,
      });
    } else {
      let hasPlayableCards = false;
      let cardId: string | undefined;
      player.playableCards.forEach((canPlay, id) => {
        if (canPlay && !cardId) {
          hasPlayableCards = true;
          cardId = id;
        }
      });

      if (hasPlayableCards && cardId) {
        await dispatcher.dispatch(new PlayCardCommand(), {
          sessionId: player.sessionId,
          cardIds: [cardId],
        });
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
  }

  private getMostCommonColor(player: Player): string {
    const colorCount: Record<string, number> = {
      red: 0,
      blue: 0,
      green: 0,
      yellow: 0,
    };

    for (const card of player.myHand) {
      if (card.color in colorCount) {
        colorCount[card.color]++;
      }
    }

    let maxColor = "red";
    let maxCount = 0;
    for (const [color, count] of Object.entries(colorCount)) {
      if (count > maxCount) {
        maxCount = count;
        maxColor = color;
      }
    }

    return maxColor;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
