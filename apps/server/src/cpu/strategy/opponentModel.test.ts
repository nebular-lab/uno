import { describe, expect, it } from "vitest";
import type { CardKind, GameLogEvent } from "../GameLog";
import type { PoolEntry } from "./handDistribution";
import {
  EXCLUDED_TOTAL_FACTOR,
  inferBeliefs,
  opponentTotalDistribution,
} from "./opponentModel";

const wild: CardKind = { color: "wild", value: "wild", points: 30 };
const draw4: CardKind = { color: "wild", value: "draw4", points: 50 };
const redSkip: CardKind = { color: "red", value: "skip", points: 20 };

function play(
  playerId: string,
  cards: CardKind[],
  handCountAfter = 5,
): GameLogEvent {
  return { type: "play", playerId, cards, handCountAfter };
}

// 1〜9の数字カードが各色2枚ずつ（0点・記号カードなし）の小さな山
function numberPool(): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const color of ["red", "blue", "green", "yellow"]) {
    for (let n = 1; n <= 9; n++) {
      pool.push({ color, value: String(n), points: n, count: 2 });
    }
  }
  return pool;
}

describe("inferBeliefs", () => {
  it("出されたカードにドボンしなかった人は、手札合計がその点数ではない", () => {
    const beliefs = inferBeliefs([play("a", [wild])], ["a", "b", "c"]);

    expect(beliefs.get("b")?.excludedTotals.has(30)).toBe(true);
    expect(beliefs.get("c")?.excludedTotals.has(30)).toBe(true);
    // 出した本人は対象外
    expect(beliefs.get("a")?.excludedTotals.has(30)).toBe(false);
  });

  it("30にドボンしなかった人が20を出したら、残りは10ではない", () => {
    const beliefs = inferBeliefs(
      [play("a", [wild]), play("b", [redSkip])],
      ["a", "b"],
    );

    expect(beliefs.get("b")?.excludedTotals.has(10)).toBe(true);
  });

  it("ドボンされない点数は、分布でも確率が下がる", () => {
    const pool = numberPool();
    const beliefs = inferBeliefs(
      [play("a", [{ color: "red", value: "9", points: 9 }])],
      ["a", "b"],
    );

    const plain = opponentTotalDistribution(undefined, 2, pool);
    const inferred = opponentTotalDistribution(beliefs.get("b"), 2, pool);

    expect(inferred[9]).toBeLessThan(plain[9] * EXCLUDED_TOTAL_FACTOR * 1.2);
    expect(inferred[10]).toBeGreaterThan(plain[10]);
  });

  it("手札が少ないときにドロー4を出した人は、残りが50点の可能性が高い", () => {
    const pool = [...numberPool(), { ...draw4, count: 3 }];
    const beliefs = inferBeliefs([play("b", [draw4], 1)], ["a", "b"]);

    expect(beliefs.get("b")?.bait?.total).toBe(50);
    const dist = opponentTotalDistribution(beliefs.get("b"), 1, pool);
    expect(dist[50]).toBeGreaterThanOrEqual(0.5);
  });

  it("ドロー4の後に20を出したら、残りは30の可能性が高い", () => {
    const pool = [...numberPool(), { ...wild, count: 3 }];
    const beliefs = inferBeliefs(
      [play("b", [draw4], 2), play("b", [redSkip], 1)],
      ["a", "b"],
    );

    expect(beliefs.get("b")?.bait?.total).toBe(30);
    const dist = opponentTotalDistribution(beliefs.get("b"), 1, pool);
    expect(dist[30]).toBeGreaterThanOrEqual(0.5);
  });

  it("手札が多いときのドロー4はドボン返し狙いとみなさない", () => {
    const beliefs = inferBeliefs([play("b", [draw4], 6)], ["a", "b"]);

    expect(beliefs.get("b")?.bait).toBeUndefined();
  });

  it("カードを引くと、それまでの推論は使えなくなる", () => {
    const beliefs = inferBeliefs(
      [
        play("a", [wild]),
        play("b", [draw4], 2),
        { type: "draw", playerId: "b", count: 1 },
      ],
      ["a", "b"],
    );

    expect(beliefs.get("b")?.excludedTotals.size).toBe(0);
    expect(beliefs.get("b")?.bait).toBeUndefined();
  });

  it("引いてパスした人は、場札の色や数字のカードを持っていなさそう", () => {
    const pool: PoolEntry[] = [
      { color: "red", value: "4", points: 4, count: 4 },
      { color: "blue", value: "2", points: 2, count: 4 },
    ];
    const beliefs = inferBeliefs(
      [
        { type: "draw", playerId: "b", count: 1 },
        { type: "pass", playerId: "b", fieldValue: "7", currentColor: "red" },
      ],
      ["a", "b"],
    );

    const plain = opponentTotalDistribution(undefined, 1, pool);
    const inferred = opponentTotalDistribution(beliefs.get("b"), 1, pool);

    expect(inferred[4]).toBeLessThan(plain[4]);
    expect(inferred[2]).toBeGreaterThan(plain[2]);
  });

  it("累積ドローを引いた人は、重ねられるドローカードを持っていなさそう", () => {
    const beliefs = inferBeliefs(
      [{ type: "draw", playerId: "b", count: 2, stackedValue: "draw2" }],
      ["a", "b"],
    );

    expect(beliefs.get("b")?.lacks).toEqual([
      { kind: "stack", value: "draw2" },
    ]);
  });

  it("色変えで選んだ色は、その人が次に行動するまで覚えておく", () => {
    const chose = inferBeliefs(
      [
        play("b", [wild], 3),
        { type: "chooseColor", playerId: "b", color: "blue" },
      ],
      ["a", "b"],
    );
    expect(chose.get("b")?.trapColor).toBe("blue");

    const acted = inferBeliefs(
      [
        play("b", [wild], 3),
        { type: "chooseColor", playerId: "b", color: "blue" },
        play("b", [{ color: "blue", value: "3", points: 3 }], 2),
      ],
      ["a", "b"],
    );
    expect(acted.get("b")?.trapColor).toBeUndefined();
  });
});
