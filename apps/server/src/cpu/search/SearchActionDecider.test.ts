import { Card, GameState, Player } from "@dobon-uno/shared";
import { describe, expect, it } from "vitest";
import { GameLog } from "../GameLog";
import { StrategyActionDecider } from "../strategy/StrategyActionDecider";
import { SearchActionDecider } from "./SearchActionDecider";

function createState(): { state: GameState; cpu: Player } {
  const state = new GameState();
  state.phase = "playing";
  state.fieldCards.push(new Card("r7", "red", "7", 7));
  state.currentColor = "red";
  const players = ["cpu", "b", "c"].map((id, i) => {
    const player = new Player();
    player.sessionId = id;
    player.seatId = i + 1;
    state.players.set(id, player);
    return player;
  });
  const [cpu, b, c] = players;
  for (const card of [
    new Card("r5", "red", "5", 5),
    new Card("r9", "red", "9", 9),
    new Card("b-skip", "blue", "skip", 20),
  ]) {
    cpu.myHand.push(card);
  }
  cpu.handCount = 3;
  cpu.playableCards.set("r5", true);
  cpu.playableCards.set("r9", true);
  cpu.canDraw = true;
  b.handCount = 4;
  c.handCount = 5;
  state.currentTurnPlayerId = "cpu";
  return { state, cpu };
}

describe("SearchActionDecider", () => {
  it("出せる手の中から選ぶ", async () => {
    const { state, cpu } = createState();

    const decision = await new SearchActionDecider(new GameLog(), {
      samples: 50,
    }).decide(state, cpu);

    expect(["playCard", "drawCard"]).toContain(decision.action);
    if (decision.action === "playCard") {
      const { cardIds } = decision.params as { cardIds: string[] };
      expect(["r5", "r9"]).toContain(cardIds[0]);
    }
  });

  it("候補を1つに絞ると評価関数のCPUと同じ手を選ぶ", async () => {
    const { state, cpu } = createState();
    const log = new GameLog();

    const search = await new SearchActionDecider(log, {
      samples: 20,
      topK: 1,
    }).decide(state, cpu);
    const strategy = await new StrategyActionDecider(log).decide(state, cpu);

    expect(search).toEqual(strategy);
  });

  it("時間の上限を超えて考え続けない", async () => {
    const { state, cpu } = createState();
    const started = Date.now();

    await new SearchActionDecider(new GameLog(), {
      samples: 10_000_000,
      budgetMs: 100,
      sliceMs: 10,
    }).decide(state, cpu);

    expect(Date.now() - started).toBeLessThan(1000);
  });
});
