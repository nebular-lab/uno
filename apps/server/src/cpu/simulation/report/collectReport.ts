import type { GameState, Player } from "@dobon-uno/shared";
import type { CardKind, GameLog, GameLogEvent } from "../../GameLog";
import { MAX_TRACKED_TOTAL } from "../../strategy/handDistribution";
import { sumPoints } from "../../strategy/opponentModel";
import {
  type DecisionTrace,
  StrategyActionDecider,
} from "../../strategy/StrategyActionDecider";
import { simulateGames } from "../simulateGames";

export interface ReplayPlayer {
  id: string;
  name: string;
  hand: CardKind[];
  total: number;
}

export interface ReplayRead {
  name: string;
  handCount: number;
  trueTotal: number;
  // 本当の合計点に、CPUがつけていた確率
  predictedTrue: number;
  mean: number;
  // ドボンに関わる点数ごとの確率（高い順）
  top: { total: number; p: number }[];
  excluded: number[];
  bait?: { total: number; weight: number; source: string };
  lacks: string[];
  trapColor?: string;
}

export interface ReplayCandidate {
  label: string;
  score: number;
  dobonRisk?: number;
  chosen: boolean;
}

export interface ReplayFrame {
  actor: string;
  kind: DecisionTrace["kind"];
  events: string[];
  players: ReplayPlayer[];
  field?: CardKind;
  currentColor: string;
  drawStack: number;
  decision: string;
  reads: ReplayRead[];
  candidates: ReplayCandidate[];
  returnRisk?: number;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  count: number;
  meanPredicted: number;
  observed: number;
}

export interface CalibrationSeries {
  key: string;
  label: string;
  samples: number;
  meanPredicted: number;
  observed: number;
  bins: CalibrationBin[];
}

export interface ReportData {
  games: number;
  replay: { frames: ReplayFrame[]; result: string };
  // 「相手の手札合計がt点である確率」の予測と実際
  calibration: CalibrationSeries[];
  // ドボン返し狙いの読み（きっかけのカードごと）
  baits: CalibrationSeries[];
  // ドボンするときの「ドボン返しされる確率」の予測と実際
  returnRisk: CalibrationSeries;
}

// ドボンに関わる点数（カード1枚・同じカードの重ね出しで出せる点数）
const TARGET_TOTALS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 30, 40, 50,
];
const BIN_EDGES = [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1.0001];

/** 予測確率と実際に当たったかを、確率の区間ごとに集計する */
class CalibrationAccumulator {
  private counts = new Array<number>(BIN_EDGES.length - 1).fill(0);
  private predicted = new Array<number>(BIN_EDGES.length - 1).fill(0);
  private hits = new Array<number>(BIN_EDGES.length - 1).fill(0);

  constructor(
    readonly key: string,
    readonly label: string,
  ) {}

  add(p: number, hit: boolean): void {
    let bin = BIN_EDGES.findIndex((edge, i) => i > 0 && p < edge) - 1;
    if (bin < 0) bin = this.counts.length - 1;
    this.counts[bin]++;
    this.predicted[bin] += p;
    if (hit) this.hits[bin]++;
  }

  toSeries(): CalibrationSeries {
    const samples = this.counts.reduce((a, b) => a + b, 0);
    const predicted = this.predicted.reduce((a, b) => a + b, 0);
    const hits = this.hits.reduce((a, b) => a + b, 0);
    return {
      key: this.key,
      label: this.label,
      samples,
      meanPredicted: samples === 0 ? 0 : predicted / samples,
      observed: samples === 0 ? 0 : hits / samples,
      bins: this.counts.map((count, i) => ({
        lo: BIN_EDGES[i],
        hi: Math.min(BIN_EDGES[i + 1], 1),
        count,
        meanPredicted: count === 0 ? 0 : this.predicted[i] / count,
        observed: count === 0 ? 0 : this.hits[i] / count,
      })),
    };
  }
}

/**
 * Strategy版のCPU4人を対戦させ、最初のゲームのリプレイと、読みの精度を集める。
 */
export async function collectReport(
  games: number,
  seed = 1,
): Promise<ReportData> {
  const calibration = {
    plain: new CalibrationAccumulator("plain", "通常の読み"),
    excluded: new CalibrationAccumulator("excluded", "ドボンしなかった点数"),
    bait: new CalibrationAccumulator("bait", "ドボン返し狙いの点数"),
  };
  const baits = new Map<string, CalibrationAccumulator>();
  const returnRisk = new CalibrationAccumulator(
    "returnRisk",
    "ドボン返しされる確率",
  );

  const frames: ReplayFrame[] = [];
  let result = "";
  let game = 0;
  let lastEventCount = 0;
  let lastDobonKey = "";

  const onTrace = (trace: DecisionTrace, state: GameState, log: GameLog) => {
    // 見送ったドボンは状態が変わるまで何度も判断されるので、1回だけ数える
    if (trace.kind === "dobon") {
      const key = `${game}:${trace.playerId}:${trace.eventCount}`;
      if (key === lastDobonKey) return;
      lastDobonKey = key;
    }

    const me = state.players.get(trace.playerId);
    if (!me) return;

    if (trace.kind === "dobon" && trace.returnRisk !== undefined) {
      const target = state.players.get(state.dobonTargetId);
      if (target && target.handCount > 0) {
        returnRisk.add(
          trace.returnRisk,
          sumPoints(target.myHand) === sumPoints(me.myHand),
        );
      }
    }

    if (trace.kind === "action" && trace.candidates.length > 0) {
      for (const opponent of trace.opponents) {
        const player = state.players.get(opponent.sessionId);
        if (!player) continue;
        const trueTotal = sumPoints(player.myHand);
        const belief = opponent.belief;
        for (const total of TARGET_TOTALS) {
          const p = opponent.dist[total];
          const hit = trueTotal === total;
          if (belief?.bait?.total === total) {
            calibration.bait.add(p, hit);
          } else if (belief?.excludedTotals.has(total)) {
            calibration.excluded.add(p, hit);
          } else {
            calibration.plain.add(p, hit);
          }
        }
        const bait = belief?.bait;
        if (bait && bait.total <= MAX_TRACKED_TOTAL) {
          let acc = baits.get(bait.source);
          if (!acc) {
            acc = new CalibrationAccumulator(
              bait.source,
              cardName(bait.source),
            );
            baits.set(bait.source, acc);
          }
          acc.add(opponent.dist[bait.total], trueTotal === bait.total);
        }
      }
    }

    if (game === 0) {
      const events = log.getEvents().slice(lastEventCount, trace.eventCount);
      lastEventCount = trace.eventCount;
      frames.push(toFrame(trace, state, events));
    }
  };

  await simulateGames({
    games,
    seats: 4,
    seed,
    entrants: [
      {
        name: "strategy",
        createDecider: (log) =>
          new StrategyActionDecider(log, {
            onTrace: (trace, state) => onTrace(trace, state, log),
          }),
      },
    ],
    onGameEnd: (state) => {
      if (game === 0) result = describeResult(state);
      game++;
      lastEventCount = 0;
    },
  });

  return {
    games,
    replay: { frames, result },
    calibration: Object.values(calibration).map((c) => c.toSeries()),
    baits: [...baits.values()].map((c) => c.toSeries()),
    returnRisk: returnRisk.toSeries(),
  };
}

function toFrame(
  trace: DecisionTrace,
  state: GameState,
  events: GameLogEvent[],
): ReplayFrame {
  const field = state.fieldCards[state.fieldCards.length - 1];
  const chosen = JSON.stringify(trace.decision);
  return {
    actor: playerName(state, trace.playerId),
    kind: trace.kind,
    events: events.map((e) => describeEvent(e, state)),
    players: [...state.players.values()]
      .sort((a, b) => a.seatId - b.seatId)
      .map((p) => ({
        id: p.sessionId,
        name: p.name,
        hand: [...p.myHand].map(toKind),
        total: sumPoints(p.myHand),
      })),
    field: field ? toKind(field) : undefined,
    currentColor: state.currentColor,
    drawStack: state.drawStack,
    decision: describeDecision(trace, state),
    reads: trace.opponents.map((o) => {
      const player = state.players.get(o.sessionId) as Player;
      const trueTotal = sumPoints(player.myHand);
      return {
        name: player.name,
        handCount: o.handCount,
        trueTotal,
        predictedTrue: trueTotal <= MAX_TRACKED_TOTAL ? o.dist[trueTotal] : 0,
        mean: o.mean,
        // カードを出すとドボンされうる点数のうち、確率が高いもの
        top: TARGET_TOTALS.map((total) => ({ total, p: o.dist[total] }))
          .sort((a, b) => b.p - a.p)
          .slice(0, 6),
        excluded: [...(o.belief?.excludedTotals ?? [])].sort((a, b) => a - b),
        bait: o.belief?.bait,
        lacks: (o.belief?.lacks ?? []).map((l) =>
          l.kind === "stack"
            ? `${cardName(l.value)}に重ねるカード`
            : `${colorName(l.color)}・${cardName(l.value)}・ワイルド類`,
        ),
        trapColor: o.belief?.trapColor,
      };
    }),
    candidates: trace.candidates.map((c) => ({
      label: describeCandidate(c.decision.action, c.cards),
      score: c.score,
      dobonRisk: c.dobonRisk,
      chosen: JSON.stringify(c.decision) === chosen,
    })),
    returnRisk: trace.returnRisk,
  };
}

function describeDecision(trace: DecisionTrace, state: GameState): string {
  const { action, params } = trace.decision;
  if (action === "playCard") {
    const ids = (params as { cardIds: string[] }).cardIds;
    const me = state.players.get(trace.playerId);
    const cards = ids
      .map((id) => me?.myHand.find((c) => c.id === id))
      .filter((c) => c !== undefined)
      .map(toKind);
    return describeCandidate(action, cards);
  }
  if (action === "chooseColor") {
    return `${colorName((params as { color: string }).color)}を選ぶ`;
  }
  return describeCandidate(action);
}

function describeCandidate(action: string, cards?: CardKind[]): string {
  switch (action) {
    case "playCard":
      return cards && cards.length > 0
        ? `${cardLabel(cards[0])}${cards.length > 1 ? ` ×${cards.length}` : ""} を出す`
        : "カードを出す";
    case "drawCard":
      return "山札から引く";
    case "drawStack":
      return "累積ドローを引く";
    case "pass":
      return "パス";
    case "dobon":
      return "ドボン！";
    case "skipDobon":
      return "ドボンを見送る";
    case "dobonReturn":
      return "ドボン返し";
    default:
      return action;
  }
}

function describeEvent(event: GameLogEvent, state: GameState): string {
  const who = event.playerId ? playerName(state, event.playerId) : "";
  switch (event.type) {
    case "play":
      if (!who) return `最初の場札は ${cardLabel(event.cards[0])}`;
      return `${who} が ${event.cards.map(cardLabel).join("・")} を出した（残り${event.handCountAfter}枚）`;
    case "draw":
      return event.stackedValue
        ? `${who} が累積ドローで${event.count}枚引いた`
        : `${who} が山札から${event.count}枚引いた`;
    case "pass":
      return `${who} がパスした`;
    case "chooseColor":
      return `${who} が${colorName(event.color)}を選んだ`;
  }
}

function describeResult(state: GameState): string {
  const result = state.gameHistory[state.gameHistory.length - 1];
  if (!result) return "山札切れで終了";
  const type =
    result.finishType === "normal"
      ? "上がり"
      : result.finishType === "dobon"
        ? "ドボン"
        : "ドボン返し";
  const changes = [...result.scoreChanges.entries()]
    .map(
      ([id, delta]) =>
        `${playerName(state, id)} ${delta > 0 ? "+" : ""}${delta}`,
    )
    .join(" / ");
  return `${playerName(state, result.winnerId)} の${type}で終了（${changes}）`;
}

function playerName(state: GameState, id: string): string {
  return state.players.get(id)?.name ?? id;
}

function toKind(card: CardKind): CardKind {
  return { color: card.color, value: card.value, points: card.points };
}

const COLOR_NAMES: Record<string, string> = {
  red: "赤",
  blue: "青",
  green: "緑",
  yellow: "黄",
  wild: "",
};

const VALUE_NAMES: Record<string, string> = {
  skip: "スキップ",
  reverse: "リバース",
  draw2: "ドロー2",
  wild: "ワイルド",
  draw4: "ドロー4",
  "force-change": "強制色変え",
};

function colorName(color: string): string {
  return COLOR_NAMES[color] ?? color;
}

function cardName(value: string): string {
  return VALUE_NAMES[value] ?? value;
}

export function cardLabel(card: CardKind): string {
  return `${colorName(card.color)}${cardName(card.value)}`;
}
