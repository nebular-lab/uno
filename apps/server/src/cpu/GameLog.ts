import type { Card } from "@dobon-uno/shared";

/** 推論に使うカードの公開情報（idは使わない） */
export interface CardKind {
  color: string;
  value: string;
  points: number;
}

/**
 * 全員に見えている行動の履歴。CPUは相手の手札を見ずに、この履歴だけから推論する。
 * playerId が空文字の play は、最初の場札（誰も出していない）を表す。
 */
export type GameLogEvent =
  | {
      type: "play";
      playerId: string;
      cards: CardKind[];
      handCountAfter: number;
    }
  | {
      type: "draw";
      playerId: string;
      count: number;
      // 累積ドローを引いた場合の場札（draw2 / draw4）
      stackedValue?: string;
    }
  | {
      type: "pass";
      playerId: string;
      fieldValue: string;
      currentColor: string;
    }
  | { type: "chooseColor"; playerId: string; color: string };

export class GameLog {
  private events: GameLogEvent[] = [];

  getEvents(): readonly GameLogEvent[] {
    return this.events;
  }

  reset(): void {
    this.events = [];
  }

  recordPlay(playerId: string, cards: Card[], handCountAfter: number): void {
    this.events.push({
      type: "play",
      playerId,
      cards: cards.map(toKind),
      handCountAfter,
    });
  }

  recordDraw(playerId: string, count: number, stackedValue?: string): void {
    this.events.push({ type: "draw", playerId, count, stackedValue });
  }

  recordPass(playerId: string, fieldValue: string, currentColor: string): void {
    this.events.push({ type: "pass", playerId, fieldValue, currentColor });
  }

  recordChooseColor(playerId: string, color: string): void {
    this.events.push({ type: "chooseColor", playerId, color });
  }
}

function toKind(card: Card): CardKind {
  return { color: card.color, value: card.value, points: card.points };
}
