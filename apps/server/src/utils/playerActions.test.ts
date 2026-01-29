import { Card, GameState, Player } from "@dobon-uno/shared";
import { describe, expect, it } from "vitest";
import {
  advanceToNextPlayer,
  canDobon,
  getPlayersSortedBySeat,
  isSymbolCard,
} from "./playerActions";

// テスト用カード作成ヘルパー
function createCard(
  id: string,
  color: string,
  value: string,
  points: number,
): Card {
  return new Card(id, color, value, points);
}

// テスト用プレイヤー作成ヘルパー
function createPlayer(sessionId: string, seatId: number): Player {
  const player = new Player();
  player.sessionId = sessionId;
  player.seatId = seatId;
  return player;
}

// テスト用GameState作成ヘルパー
function createGameState(): GameState {
  return new GameState();
}

describe("isSymbolCard", () => {
  it("skipは記号カード", () => {
    const card = createCard("r-skip", "red", "skip", 20);
    expect(isSymbolCard(card)).toBe(true);
  });

  it("reverseは記号カード", () => {
    const card = createCard("r-reverse", "red", "reverse", 20);
    expect(isSymbolCard(card)).toBe(true);
  });

  it("draw2は記号カード", () => {
    const card = createCard("r-draw2", "red", "draw2", 20);
    expect(isSymbolCard(card)).toBe(true);
  });

  it("wildは記号カード", () => {
    const card = createCard("wild-1", "wild", "wild", 30);
    expect(isSymbolCard(card)).toBe(true);
  });

  it("draw4は記号カード", () => {
    const card = createCard("draw4-1", "wild", "draw4", 50);
    expect(isSymbolCard(card)).toBe(true);
  });

  it("force-changeは記号カード", () => {
    const card = createCard("force-red", "red", "force-change", 10);
    expect(isSymbolCard(card)).toBe(true);
  });

  it("数字カードは記号カードではない", () => {
    const card = createCard("r5", "red", "5", 5);
    expect(isSymbolCard(card)).toBe(false);
  });

  it("0も記号カードではない", () => {
    const card = createCard("r0", "red", "0", 0);
    expect(isSymbolCard(card)).toBe(false);
  });
});

describe("canDobon", () => {
  it("手札合計が場札の点数と一致すればtrue", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("r3", "red", "3", 3));
    player.myHand.push(createCard("r2", "red", "2", 2));

    const fieldCard = createCard("r5", "red", "5", 5);

    expect(canDobon(player, fieldCard)).toBe(true);
  });

  it("手札合計が場札の点数と一致しなければfalse", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("r3", "red", "3", 3));
    player.myHand.push(createCard("r3-2", "red", "3", 3));

    const fieldCard = createCard("r5", "red", "5", 5);

    expect(canDobon(player, fieldCard)).toBe(false);
  });

  it("手札が0点で場札も0点ならtrue", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("r0", "red", "0", 0));
    player.myHand.push(createCard("b0", "blue", "0", 0));

    const fieldCard = createCard("g0", "green", "0", 0);

    expect(canDobon(player, fieldCard)).toBe(true);
  });

  it("記号カードを含む手札でも点数が一致すればtrue", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("r-skip", "red", "skip", 20));
    player.myHand.push(createCard("b0", "blue", "0", 0));

    const fieldCard = createCard("g-draw2", "green", "draw2", 20);

    expect(canDobon(player, fieldCard)).toBe(true);
  });
});

describe("getPlayersSortedBySeat", () => {
  it("座席順でソートされたプレイヤー配列を返す", () => {
    const state = createGameState();

    const p1 = createPlayer("p1", 3);
    const p2 = createPlayer("p2", 1);
    const p3 = createPlayer("p3", 2);

    state.players.set("p1", p1);
    state.players.set("p2", p2);
    state.players.set("p3", p3);

    const sorted = getPlayersSortedBySeat(state);

    expect(sorted.length).toBe(3);
    expect(sorted[0].sessionId).toBe("p2"); // seatId: 1
    expect(sorted[1].sessionId).toBe("p3"); // seatId: 2
    expect(sorted[2].sessionId).toBe("p1"); // seatId: 3
  });

  it("プレイヤーが1人の場合もソートできる", () => {
    const state = createGameState();

    const p1 = createPlayer("p1", 1);
    state.players.set("p1", p1);

    const sorted = getPlayersSortedBySeat(state);

    expect(sorted.length).toBe(1);
    expect(sorted[0].sessionId).toBe("p1");
  });
});

describe("advanceToNextPlayer", () => {
  it("時計回り（direction=1）で次のプレイヤーに移動する", () => {
    const state = createGameState();
    state.turnDirection = 1;

    const p1 = createPlayer("p1", 1);
    const p2 = createPlayer("p2", 2);
    const p3 = createPlayer("p3", 3);

    state.players.set("p1", p1);
    state.players.set("p2", p2);
    state.players.set("p3", p3);
    state.currentTurnPlayerId = "p1";

    advanceToNextPlayer(state);

    expect(state.currentTurnPlayerId).toBe("p2");
  });

  it("反時計回り（direction=-1）で前のプレイヤーに移動する", () => {
    const state = createGameState();
    state.turnDirection = -1;

    const p1 = createPlayer("p1", 1);
    const p2 = createPlayer("p2", 2);
    const p3 = createPlayer("p3", 3);

    state.players.set("p1", p1);
    state.players.set("p2", p2);
    state.players.set("p3", p3);
    state.currentTurnPlayerId = "p2";

    advanceToNextPlayer(state);

    expect(state.currentTurnPlayerId).toBe("p1");
  });

  it("時計回りで最後のプレイヤーから最初のプレイヤーに戻る", () => {
    const state = createGameState();
    state.turnDirection = 1;

    const p1 = createPlayer("p1", 1);
    const p2 = createPlayer("p2", 2);
    const p3 = createPlayer("p3", 3);

    state.players.set("p1", p1);
    state.players.set("p2", p2);
    state.players.set("p3", p3);
    state.currentTurnPlayerId = "p3";

    advanceToNextPlayer(state);

    expect(state.currentTurnPlayerId).toBe("p1");
  });

  it("反時計回りで最初のプレイヤーから最後のプレイヤーに移動する", () => {
    const state = createGameState();
    state.turnDirection = -1;

    const p1 = createPlayer("p1", 1);
    const p2 = createPlayer("p2", 2);
    const p3 = createPlayer("p3", 3);

    state.players.set("p1", p1);
    state.players.set("p2", p2);
    state.players.set("p3", p3);
    state.currentTurnPlayerId = "p1";

    advanceToNextPlayer(state);

    expect(state.currentTurnPlayerId).toBe("p3");
  });
});
