import { Card, GameState, Player } from "@dobon-uno/shared";
import { describe, expect, it } from "vitest";
import { GameLog } from "../GameLog";
import { StrategyActionDecider } from "./StrategyActionDecider";

function createPlayer(sessionId: string, cards: Card[] = []): Player {
  const player = new Player();
  player.sessionId = sessionId;
  player.name = sessionId;
  for (const card of cards) player.myHand.push(card);
  player.handCount = cards.length;
  return player;
}

// CPUと相手（手札枚数だけ分かる）のGameStateを作成
function createState(
  cpu: Player,
  opponents: Record<string, number>,
  field = new Card("r7", "red", "7", 7),
): GameState {
  const state = new GameState();
  state.phase = "playing";
  state.fieldCards.push(field);
  state.currentColor = field.color;
  state.currentTurnPlayerId = cpu.sessionId;
  state.players.set(cpu.sessionId, cpu);
  for (const [id, handCount] of Object.entries(opponents)) {
    const opponent = createPlayer(id);
    opponent.handCount = handCount;
    state.players.set(id, opponent);
  }
  return state;
}

function setPlayable(player: Player, ...ids: string[]): void {
  for (const id of ids) player.playableCards.set(id, true);
}

describe("StrategyActionDecider", () => {
  it("同じカードが複数あれば重ねて出して上がる", async () => {
    const cpu = createPlayer("cpu", [
      new Card("r5", "red", "5", 5),
      new Card("r5-2", "red", "5", 5),
    ]);
    setPlayable(cpu, "r5", "r5-2");
    cpu.canDraw = true;
    const state = createState(cpu, { b: 7 });

    const decision = await new StrategyActionDecider(new GameLog()).decide(
      state,
      cpu,
    );

    expect(decision).toEqual({
      action: "playCard",
      params: { cardIds: ["r5", "r5-2"] },
    });
  });

  it("相手がドボンしなかった点数のカードを優先して出す", async () => {
    const cpu = createPlayer("cpu", [
      new Card("r9", "red", "9", 9),
      new Card("r8", "red", "8", 8),
      // 残りの合計（28点か29点）ではどちらもドボンを狙えないようにする
      new Card("b-skip", "blue", "skip", 20),
    ]);
    setPlayable(cpu, "r9", "r8");
    const state = createState(cpu, { b: 1, c: 7 });
    const log = new GameLog();
    // cが8を出したが、手札1枚のbはドボンしなかった → bの手札は8点ではない
    log.recordPlay("c", [new Card("g8", "green", "8", 8)], 7);

    const decision = await new StrategyActionDecider(log).decide(state, cpu);

    expect(decision).toEqual({
      action: "playCard",
      params: { cardIds: ["r8"] },
    });
  });

  it("色変えで選ばれた色のカードは避ける", async () => {
    const cpu = createPlayer("cpu", [
      new Card("b3", "blue", "3", 3),
      new Card("r3", "red", "3", 3),
      new Card("g9", "green", "9", 9),
    ]);
    setPlayable(cpu, "b3", "r3");
    const state = createState(cpu, { b: 1 }, new Card("r3x", "red", "3", 3));
    const log = new GameLog();
    log.recordPlay("b", [new Card("wild-1", "wild", "wild", 30)], 1);
    log.recordChooseColor("b", "blue");

    const decision = await new StrategyActionDecider(log).decide(state, cpu);

    expect(decision).toEqual({
      action: "playCard",
      params: { cardIds: ["r3"] },
    });
  });

  it("ドボン返し狙いの相手にはドボンしない", () => {
    const cpu = createPlayer("cpu", [
      new Card("y-skip", "yellow", "skip", 20),
      new Card("w", "wild", "wild", 30),
    ]);
    cpu.canDobon = true;
    const state = createState(
      cpu,
      { b: 1 },
      new Card("d1", "wild", "draw4", 50),
    );
    state.dobonTargetId = "b";
    const log = new GameLog();
    // 手札が少ないときにドロー4を出した → 残りも50点（ドロー4）の可能性が高い
    log.recordPlay("b", [new Card("d1", "wild", "draw4", 50)], 1);

    expect(new StrategyActionDecider(log).decideDobon(state, cpu)).toBe(false);
  });

  it("ドボン返しの心配がなければドボンする", () => {
    const cpu = createPlayer("cpu", [
      new Card("y-skip", "yellow", "skip", 20),
      new Card("w", "wild", "wild", 30),
    ]);
    cpu.canDobon = true;
    const state = createState(
      cpu,
      { b: 6 },
      new Card("d1", "wild", "draw4", 50),
    );
    state.dobonTargetId = "b";
    const log = new GameLog();
    log.recordPlay("b", [new Card("d1", "wild", "draw4", 50)], 6);

    expect(new StrategyActionDecider(log).decideDobon(state, cpu)).toBe(true);
  });

  it("上がりのカードには必ずドボンする（見送ると上がられる）", () => {
    const cpu = createPlayer("cpu", [new Card("r5", "red", "5", 5)]);
    cpu.canDobon = true;
    const state = createState(cpu, { b: 0 }, new Card("b5", "blue", "5", 5));
    state.dobonTargetId = "b";

    expect(
      new StrategyActionDecider(new GameLog()).decideDobon(state, cpu),
    ).toBe(true);
  });

  it("色選択では手札に多い色を選ぶ", async () => {
    const cpu = createPlayer("cpu", [
      new Card("g1", "green", "1", 1),
      new Card("g2", "green", "2", 2),
      new Card("r9", "red", "9", 9),
    ]);
    cpu.canChooseColor = true;
    const state = createState(cpu, { b: 5 });

    const decision = await new StrategyActionDecider(new GameLog()).decide(
      state,
      cpu,
    );

    expect(decision).toEqual({
      action: "chooseColor",
      params: { color: "green" },
    });
  });
});
