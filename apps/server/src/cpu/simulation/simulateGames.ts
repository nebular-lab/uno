import { Dispatcher } from "@colyseus/command";
import { type Card, GameState, Player } from "@dobon-uno/shared";
import { DobonCommand } from "../../commands/DobonCommand";
import { DobonReturnCommand } from "../../commands/DobonReturnCommand";
import { StartGameCommand } from "../../commands/StartGameCommand";
import { GameRoom } from "../../rooms/GameRoom";
import { createDeck, shuffleDeck } from "../../utils/deck";
import type { ActionDecider } from "../ActionDecider";
import {
  executeDecision,
  fallbackDecision,
  hasAnyAction,
} from "../executeDecision";
import { GameLog } from "../GameLog";

export interface SimulationEntrant {
  name: string;
  createDecider: (log: GameLog) => ActionDecider;
}

export interface EntrantStats {
  name: string;
  seats: number;
  totalScore: number;
  averageScore: number;
  normalWins: number;
  dobonWins: number;
  dobonReturnWins: number;
  // ドボン・ドボン返しされて払った回数
  dobonLosses: number;
}

export interface SimulationResult {
  games: number;
  deckOuts: number;
  stalls: number;
  entrants: EntrantStats[];
}

export interface SimulationOptions {
  entrants: SimulationEntrant[];
  games: number;
  // 各席に座るエントリーの並び（省略時は entrants を順に繰り返す）
  seats?: number;
  seed?: number;
}

// 1ゲームでこれ以上行動しても終わらなければ打ち切る
const MAX_STEPS_PER_GAME = 3000;

/**
 * 本物のCommandを使って、CPU同士の対戦を高速に繰り返す。
 * タイマーや演出の待ち時間は使わず、行動できる人がいなくなったときだけタイムアウトを発火させる。
 */
export async function simulateGames(
  options: SimulationOptions,
): Promise<SimulationResult> {
  const { entrants, games, seed = 1 } = options;
  const seatCount = options.seats ?? Math.max(entrants.length, 4);
  const room = new SimulationRoom();
  const stats = entrants.map<EntrantStats>((e) => ({
    name: e.name,
    seats: 0,
    totalScore: 0,
    averageScore: 0,
    normalWins: 0,
    dobonWins: 0,
    dobonReturnWins: 0,
    dobonLosses: 0,
  }));

  const playerIds: string[] = [];
  for (let seat = 1; seat <= seatCount; seat++) {
    const player = new Player();
    player.sessionId = `sim-${seat}`;
    player.name = `CPU ${seat}`;
    player.seatId = seat;
    player.isCpu = true;
    player.isOwner = seat === 1;
    room.state.players.set(player.sessionId, player);
    playerIds.push(player.sessionId);
  }

  let deckOuts = 0;
  let stalls = 0;

  for (let game = 0; game < games; game++) {
    // 席の有利不利が偏らないよう、ゲームごとに座る席をずらす
    const deciders = new Map<
      string,
      { index: number; decider: ActionDecider }
    >();
    playerIds.forEach((id, seat) => {
      const index = (seat + game) % entrants.length;
      deciders.set(id, {
        index,
        decider: entrants[index].createDecider(room.gameLog),
      });
      stats[index].seats++;
    });

    const historyLength = room.state.gameHistory.length;
    const before = new Map(
      playerIds.map((id) => [id, room.state.players.get(id)?.score ?? 0]),
    );
    room.nextDeck = shuffleDeck(createDeck(), seed + game);
    const outcome = await playOneGame(room, playerIds, deciders);
    if (outcome === "stall") stalls++;

    const finished = room.state.gameHistory.length > historyLength;
    const result = room.state.gameHistory[room.state.gameHistory.length - 1];
    if (!finished && outcome !== "stall") deckOuts++;

    for (const id of playerIds) {
      const entry = deciders.get(id);
      if (!entry) continue;
      const stat = stats[entry.index];
      const delta =
        (room.state.players.get(id)?.score ?? 0) - (before.get(id) ?? 0);
      stat.totalScore += delta;
      if (finished && delta > 0) {
        if (result.finishType === "normal") stat.normalWins++;
        if (result.finishType === "dobon") stat.dobonWins++;
        if (result.finishType === "dobonReturn") stat.dobonReturnWins++;
      }
      if (finished && delta < 0 && result.finishType !== "normal") {
        stat.dobonLosses++;
      }
    }

    room.finishGame();
  }

  for (const stat of stats) {
    stat.averageScore = stat.seats === 0 ? 0 : stat.totalScore / stat.seats;
  }
  return { games, deckOuts, stalls, entrants: stats };
}

async function playOneGame(
  room: SimulationRoom,
  playerIds: string[],
  deciders: Map<string, { decider: ActionDecider }>,
): Promise<"done" | "stall"> {
  const { state, dispatcher } = room;
  dispatcher.dispatch(new StartGameCommand(), {
    sessionId: playerIds[0],
    startPlayerId: state.nextGameStartPlayerId || undefined,
    rateMultiplier: state.rateMultiplier,
  });
  room.flushClock();

  for (let step = 0; step < MAX_STEPS_PER_GAME; step++) {
    if (state.phase !== "playing") return "done";

    if (await stepOnce(room, deciders)) continue;

    // 誰も行動しない → 手番の人のタイムアウトを発火させる
    if (!room.fireTimer()) return "stall";
  }
  return "stall";
}

/**
 * 1つ行動を進める。行動できる人がいなければ false。
 */
async function stepOnce(
  room: SimulationRoom,
  deciders: Map<string, { decider: ActionDecider }>,
): Promise<boolean> {
  const { state, dispatcher } = room;

  for (const player of state.players.values()) {
    if (player.canDobonReturn) {
      dispatcher.dispatch(new DobonReturnCommand(), {
        sessionId: player.sessionId,
      });
      return true;
    }
  }

  // ドボンは手番に関係なく、宣言したい人から
  for (const player of state.players.values()) {
    if (!player.canDobon) continue;
    const decider = deciders.get(player.sessionId)?.decider;
    if (decider?.decideDobon?.(state, player) ?? true) {
      const signature = room.signature();
      dispatcher.dispatch(new DobonCommand(), { sessionId: player.sessionId });
      if (room.signature() !== signature) return true;
    }
  }

  const current = state.players.get(state.currentTurnPlayerId);
  if (!current || !hasAnyAction(current)) return false;
  const decider = deciders.get(current.sessionId)?.decider;
  if (!decider) return false;

  const signature = room.signature();
  try {
    const decision = await decider.decide(state, current);
    executeDecision(decision, current.sessionId, dispatcher);
  } catch {
    // フォールバックに任せる
  }
  if (room.signature() !== signature) return true;

  const fallback = fallbackDecision(current);
  if (!fallback) return false;
  executeDecision(fallback, current.sessionId, dispatcher);
  return room.signature() !== signature;
}

/**
 * Commandが使うGameRoomの機能だけを持つ、シミュレーション用のルーム。
 */
class SimulationRoom {
  state = new GameState();
  deck: Card[] = [];
  nextDeck: Card[] = [];
  gameLog = new GameLog();
  dispatcher = new Dispatcher(this as unknown as GameRoom);

  private queue: (() => void)[] = [];
  private timers = new Map<string, () => void>();

  clock = {
    setTimeout: (callback: () => void) => {
      this.queue.push(callback);
      return { clear: () => {} };
    },
  };

  turnTimerService = {
    startTimer: (playerId: string, onTimeout: () => void) => {
      this.timers.set(playerId, onTimeout);
    },
    stopTimer: (playerId: string) => {
      this.timers.delete(playerId);
    },
    stopAllTimers: () => {
      this.timers.clear();
    },
  };

  createDeck(): Card[] {
    return this.nextDeck;
  }

  broadcast(): void {}

  checkCPUTurn(): void {}

  resetGameState(): void {
    GameRoom.prototype.resetGameState.call(this as unknown as GameRoom);
  }

  /** 演出待ちのタイマー（配布・カウントダウン・結果表示）をすぐに進める */
  flushClock(): void {
    while (this.queue.length > 0) {
      this.queue.shift()?.();
    }
  }

  /** 手番の人のタイムアウトを発火させる（なければ他の誰か） */
  fireTimer(): boolean {
    const id = this.timers.has(this.state.currentTurnPlayerId)
      ? this.state.currentTurnPlayerId
      : this.timers.keys().next().value;
    if (id === undefined) return false;
    const onTimeout = this.timers.get(id);
    this.timers.delete(id);
    onTimeout?.();
    return true;
  }

  /** 結果表示を飛ばして次のゲームを始められる状態に戻す */
  finishGame(): void {
    this.flushClock();
    if (this.state.phase !== "waiting") {
      this.resetGameState();
      this.state.phase = "waiting";
    }
    this.timers.clear();
  }

  signature(): string {
    let hands = 0;
    for (const p of this.state.players.values())
      hands = hands * 31 + p.handCount;
    return [
      this.gameLog.getEvents().length,
      this.state.phase,
      this.state.currentTurnPlayerId,
      this.state.waitingForColorChoice,
      this.state.dobonPlayerIds.length,
      hands,
    ].join("|");
  }
}
