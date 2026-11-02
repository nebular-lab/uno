import type { Dispatcher } from "@colyseus/command";
import { Card, GameState, Player } from "@dobon-uno/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { PlayCardCommand } from "../commands/PlayCardCommand";
import { SkipDobonCommand } from "../commands/SkipDobonCommand";
import type { GameRoom } from "../rooms/GameRoom";
import type { ActionDecider } from "./ActionDecider";
import { CPUPlayerService } from "./CPUPlayerService";
import { GameLog } from "./GameLog";

function createCpu(): Player {
  const player = new Player();
  player.sessionId = "cpu";
  player.isCpu = true;
  player.myHand.push(new Card("r5", "red", "5", 5));
  player.handCount = 1;
  return player;
}

function createDispatcher() {
  const dispatch = vi.fn();
  return {
    dispatch,
    dispatcher: { dispatch } as unknown as Dispatcher<GameRoom>,
  };
}

describe("CPUPlayerService.handleDobonDecision", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("手番でなくてもドボンできればドボンする", async () => {
    const decider: ActionDecider = {
      decide: vi.fn(),
      decideDobon: () => true,
    };
    const service = new CPUPlayerService(new GameLog(), decider);
    const cpu = createCpu();
    cpu.canDobon = true;
    // カットインできるカードがあっても出さない
    cpu.playableCards.set("r5", true);
    const { dispatch, dispatcher } = createDispatcher();

    const done = service.handleDobonDecision(new GameState(), cpu, dispatcher);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(DobonCommand);
    expect(decider.decide).not.toHaveBeenCalled();
  });

  it("ドボンを見送ると判断したらドボンしないを宣言する", async () => {
    const service = new CPUPlayerService(new GameLog(), {
      decide: vi.fn(),
      decideDobon: () => false,
    });
    const cpu = createCpu();
    cpu.canDobon = true;
    const { dispatch, dispatcher } = createDispatcher();

    const done = service.handleDobonDecision(new GameState(), cpu, dispatcher);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(SkipDobonCommand);
  });

  it("手番でなくてもドボン返しする", async () => {
    const service = new CPUPlayerService(new GameLog(), { decide: vi.fn() });
    const cpu = createCpu();
    cpu.canDobonReturn = true;
    const { dispatch, dispatcher } = createDispatcher();

    const done = service.handleDobonDecision(new GameState(), cpu, dispatcher);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(DobonReturnCommand);
  });

  it("同じCPUのドボンを二重に予約しない", async () => {
    const service = new CPUPlayerService(new GameLog(), {
      decide: vi.fn(),
      decideDobon: () => true,
    });
    const cpu = createCpu();
    cpu.canDobon = true;
    const { dispatch, dispatcher } = createDispatcher();

    const first = service.handleDobonDecision(new GameState(), cpu, dispatcher);
    const second = service.handleDobonDecision(
      new GameState(),
      cpu,
      dispatcher,
    );
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});

describe("CPUPlayerService.handleCutIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // 他の人の手番で、CPUが場札と同じ赤5を持っている場面
  function setup(decideCutIn: ActionDecider["decideCutIn"]) {
    const log = new GameLog();
    log.recordPlay("human", [new Card("h-r5", "red", "5", 5)], 3);
    const decider: ActionDecider = { decide: vi.fn(), decideCutIn };
    const service = new CPUPlayerService(log, decider);
    const cpu = createCpu();
    cpu.playableCards.set("r5", true);
    const state = new GameState();
    state.phase = "playing";
    state.currentTurnPlayerId = "human";
    state.players.set(cpu.sessionId, cpu);
    return { log, service, cpu, state, ...createDispatcher() };
  }

  const cutIn = () => ({ action: "playCard", params: { cardIds: ["r5"] } });

  it("カットインすると判断したら1秒後にカードを出す", async () => {
    const { service, cpu, state, dispatch, dispatcher } = setup(cutIn);

    const done = service.handleCutIn(state, cpu, dispatcher);
    await vi.advanceTimersByTimeAsync(999);
    expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(PlayCardCommand);
    expect(dispatch.mock.calls[0][1]).toEqual({
      sessionId: "cpu",
      cardIds: ["r5"],
    });
  });

  it("カットインしないと判断したらカードを出さない", async () => {
    const { service, cpu, state, dispatch, dispatcher } = setup(
      () => undefined,
    );

    const done = service.handleCutIn(state, cpu, dispatcher);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("待っている間に場が動いたらカードを出さない", async () => {
    const { log, service, cpu, state, dispatch, dispatcher } = setup(cutIn);

    const done = service.handleCutIn(state, cpu, dispatcher);
    log.recordDraw("human", 1);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("待っている間にドボン待ちになったらカードを出さない", async () => {
    const { service, cpu, state, dispatch, dispatcher } = setup(cutIn);

    const done = service.handleCutIn(state, cpu, dispatcher);
    state.waitingForDobon = true;
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("自分の手番ではカットインの判断をしない", async () => {
    const decideCutIn = vi.fn(cutIn);
    const { service, cpu, state, dispatch, dispatcher } = setup(decideCutIn);
    state.currentTurnPlayerId = "cpu";

    await service.handleCutIn(state, cpu, dispatcher);

    expect(decideCutIn).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("同じ場面で二重にカットインしない", async () => {
    const decideCutIn = vi.fn(cutIn);
    const { service, cpu, state, dispatch, dispatcher } = setup(decideCutIn);

    const first = service.handleCutIn(state, cpu, dispatcher);
    const second = service.handleCutIn(state, cpu, dispatcher);
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(decideCutIn).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
