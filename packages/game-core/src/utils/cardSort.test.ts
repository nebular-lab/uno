import { sortCards } from "@dobon-uno/shared";
import { describe, expect, it } from "vitest";

const card = (color: string, value: string) => ({ color, value });

describe("sortCards", () => {
  it("数字カード → 強制色変え → 記号カード → ワイルド系の順に並ぶ", () => {
    const cards = [
      card("wild", "draw4"),
      card("green", "skip"),
      card("blue", "force-change"),
      card("wild", "wild"),
      card("red", "draw2"),
      card("yellow", "9"),
      card("red", "force-change"),
      card("red", "1"),
    ];

    expect(sortCards(cards)).toEqual([
      card("red", "1"),
      card("yellow", "9"),
      card("red", "force-change"),
      card("blue", "force-change"),
      card("red", "draw2"),
      card("green", "skip"),
      card("wild", "wild"),
      card("wild", "draw4"),
    ]);
  });
});
