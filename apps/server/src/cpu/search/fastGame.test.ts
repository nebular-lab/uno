import { describe, expect, it } from "vitest";
import type { CardKind } from "../GameLog";
import { type FastState, isPlayable, play } from "./fastGame";

const card = (color: string, value: string, points: number): CardKind => ({
  color,
  value,
  points,
});

function createState(hands: CardKind[][]): FastState {
  return {
    hands,
    deck: [card("red", "1", 1), card("blue", "2", 2)],
    top: card("red", "7", 7),
    color: "red",
    drawStack: 0,
    turn: 0,
    direction: 1,
  };
}

describe("fastGame", () => {
  it("出したカードの点数と手札合計が同じ人がいればドボンで終わる", () => {
    const red5 = card("red", "5", 5);
    const state = createState([
      [red5, card("blue", "9", 9)],
      [card("green", "2", 2), card("yellow", "3", 3)],
      [card("green", "8", 8)],
    ]);

    play(state, [red5]);

    // 全員の手札合計（9 + 5 + 8）＋出したカード5 = 27 をドボンした人が受け取る
    expect(state.result).toEqual([-27, 27, 0]);
  });

  it("残りが出したカードと同じ点数ならドボン返しになる", () => {
    const red5 = card("red", "5", 5);
    const state = createState([
      [red5, card("blue", "5", 5)],
      [card("green", "5", 5)],
      [card("green", "8", 8)],
    ]);

    play(state, [red5]);

    expect(state.result).toEqual([23, -23, 0]);
  });

  it("出し切れば上がりで、他の人が手札の合計を払う", () => {
    const red5 = card("red", "5", 5);
    const state = createState([
      [red5],
      [card("green", "9", 9)],
      [card("green", "8", 8)],
    ]);

    play(state, [red5]);

    expect(state.result).toEqual([17, -9, -8]);
  });

  it("スキップは次の人を飛ばし、ドロー2は累積する", () => {
    const skip = card("red", "skip", 20);
    const state = createState([
      [skip, card("blue", "9", 9)],
      [card("green", "1", 1), card("green", "2", 2)],
      [card("green", "8", 8), card("yellow", "4", 4)],
    ]);

    play(state, [skip]);
    expect(state.turn).toBe(2);

    const draw2 = card("green", "draw2", 20);
    state.hands[2].push(draw2);
    state.color = "green";
    play(state, [draw2]);
    expect(state.drawStack).toBe(2);
    expect(isPlayable(state, card("blue", "9", 9))).toBe(false);
  });
});
