import type { Dispatcher } from "@colyseus/command";
import { Card, GameState, Player } from "@dobon-uno/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
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

describe("CPUPlayerService.handleOffTurn", () => {
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

    const done = service.handleOffTurn(new GameState(), cpu, dispatcher);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(DobonCommand);
    expect(decider.decide).not.toHaveBeenCalled();
  });

  it("ドボンを見送ると判断したら宣言しない", async () => {
    const service = new CPUPlayerService(new GameLog(), {
      decide: vi.fn(),
      decideDobon: () => false,
    });
    const cpu = createCpu();
    cpu.canDobon = true;
    const { dispatch, dispatcher } = createDispatcher();

    const done = service.handleOffTurn(new GameState(), cpu, dispatcher);
    await vi.runAllTimersAsync();
    await done;

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("手番でなくてもドボン返しする", async () => {
    const service = new CPUPlayerService(new GameLog(), { decide: vi.fn() });
    const cpu = createCpu();
    cpu.canDobonReturn = true;
    const { dispatch, dispatcher } = createDispatcher();

    const done = service.handleOffTurn(new GameState(), cpu, dispatcher);
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

    const first = service.handleOffTurn(new GameState(), cpu, dispatcher);
    const second = service.handleOffTurn(new GameState(), cpu, dispatcher);
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
