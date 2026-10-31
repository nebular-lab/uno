import { Card, GameState, Player } from "@dobon-uno/shared";
import { describe, expect, it } from "vitest";
import {
  buildUnseenPool,
  handTotalDistribution,
  MAX_TRACKED_TOTAL,
} from "./handDistribution";

describe("handTotalDistribution", () => {
  it("未見のカードから引いた手札合計の確率を正確に数える", () => {
    // 5点が2枚、3点が2枚から2枚 → 10点:1通り、8点:4通り、6点:1通り（全6通り）
    const dist = handTotalDistribution(
      [
        { points: 5, count: 2, weight: 1 },
        { points: 3, count: 2, weight: 1 },
      ],
      2,
    );

    expect(dist[10]).toBeCloseTo(1 / 6);
    expect(dist[8]).toBeCloseTo(4 / 6);
    expect(dist[6]).toBeCloseTo(1 / 6);
  });

  it("持っていなさそうなカードは重みの分だけ確率が下がる", () => {
    const dist = handTotalDistribution(
      [
        { points: 5, count: 1, weight: 0.5 },
        { points: 3, count: 1, weight: 1 },
      ],
      1,
    );

    expect(dist[5]).toBeCloseTo(1 / 3);
    expect(dist[3]).toBeCloseTo(2 / 3);
  });

  it("上限を超える合計はまとめて末尾に入る", () => {
    const dist = handTotalDistribution(
      [{ points: 50, count: 4, weight: 1 }],
      3,
    );

    expect(dist[MAX_TRACKED_TOTAL + 1]).toBeCloseTo(1);
  });
});

describe("buildUnseenPool", () => {
  it("自分の手札と場に出たカードを除く", () => {
    const me = new Player();
    me.sessionId = "me";
    me.myHand.push(new Card("d1", "wild", "draw4", 50));
    const state = new GameState();
    state.players.set("me", me);
    state.fieldCards.push(new Card("d2", "wild", "draw4", 50));

    const pool = buildUnseenPool(state, me);

    const draw4 = pool.find((e) => e.value === "draw4");
    expect(draw4?.count).toBe(2);
    expect(pool.reduce((sum, e) => sum + e.count, 0)).toBe(110);
  });
});
