import { describe, expect, it } from "vitest";
import { StrategyActionDecider } from "../strategy/StrategyActionDecider";
import { SimpleActionDecider } from "./SimpleActionDecider";
import { simulateGames } from "./simulateGames";

describe("simulateGames", () => {
  it("本物のCommandでCPU同士の対戦を最後まで進められる", async () => {
    const result = await simulateGames({
      games: 20,
      seats: 4,
      entrants: [
        {
          name: "strategy",
          createDecider: (log) => new StrategyActionDecider(log),
        },
        { name: "simple", createDecider: () => new SimpleActionDecider() },
      ],
    });

    expect(result.stalls).toBe(0);
    // ゼロサムなので合計は0
    const total = result.entrants.reduce((sum, e) => sum + e.totalScore, 0);
    expect(total).toBe(0);
  });
});
