import type { Dispatcher } from "@colyseus/command";
import type { Player } from "@dobon-uno/shared";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
import { PlayCardCommand } from "../commands/PlayCardCommand";
import type { GameRoom } from "../rooms/GameRoom";
import type { CPUDecision } from "./ActionDecider";

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

// paramsから出すカードのIDを取得（cardIds: 重ね出し、cardId: 1枚）
function getCardIds(params: unknown): string[] {
  if (!isObject(params)) return [];
  const { cardIds, cardId } = params;
  if (Array.isArray(cardIds)) {
    return cardIds.filter((id): id is string => typeof id === "string");
  }
  return typeof cardId === "string" ? [cardId] : [];
}

/**
 * CPUの決定をCommandとして実行する
 */
export function executeDecision(
  decision: CPUDecision,
  sessionId: string,
  dispatcher: Dispatcher<GameRoom>,
): void {
  switch (decision.action) {
    case "playCard": {
      const cardIds = getCardIds(decision.params);
      if (cardIds.length > 0) {
        dispatcher.dispatch(new PlayCardCommand(), { sessionId, cardIds });
      }
      break;
    }

    case "drawCard":
      dispatcher.dispatch(new DrawCardCommand(), { sessionId });
      break;

    case "drawStack":
      dispatcher.dispatch(new DrawStackCommand(), { sessionId });
      break;

    case "pass":
      dispatcher.dispatch(new PassCommand(), { sessionId });
      break;

    case "dobon":
      dispatcher.dispatch(new DobonCommand(), { sessionId });
      break;

    case "dobonReturn":
      dispatcher.dispatch(new DobonReturnCommand(), { sessionId });
      break;

    case "chooseColor": {
      const color = getString(decision.params, "color") ?? "red";
      dispatcher.dispatch(new ChooseColorCommand(), { sessionId, color });
      break;
    }

    default:
      console.warn(`Unknown CPU action: ${decision.action}`);
  }
}

/**
 * 決定に失敗したときの行動。
 * 優先順位: ドボン返し > ドボン > 色選択 > カード出す > 累積引く > 山札引く > パス
 */
export function fallbackDecision(player: Player): CPUDecision | undefined {
  if (player.canDobonReturn) return { action: "dobonReturn" };
  if (player.canDobon) return { action: "dobon" };
  if (player.canChooseColor) {
    return {
      action: "chooseColor",
      params: { color: getMostCommonColor(player) },
    };
  }

  let cardId: string | undefined;
  player.playableCards.forEach((canPlay, id) => {
    if (canPlay && !cardId) cardId = id;
  });
  if (cardId) return { action: "playCard", params: { cardIds: [cardId] } };
  if (player.canDrawStack) return { action: "drawStack" };
  if (player.canDraw) return { action: "drawCard" };
  if (player.canPass) return { action: "pass" };
  return undefined;
}

/**
 * 手番のプレイヤーが取れる行動があるか
 */
export function hasAnyAction(player: Player): boolean {
  let hasPlayable = false;
  player.playableCards.forEach((canPlay) => {
    if (canPlay) hasPlayable = true;
  });
  return (
    hasPlayable ||
    player.canDraw ||
    player.canDrawStack ||
    player.canPass ||
    player.canChooseColor ||
    player.canDobon ||
    player.canDobonReturn
  );
}

function getMostCommonColor(player: Player): string {
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
