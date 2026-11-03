import { Card, GameState, Player } from "@dobon-uno/shared";
import { describe, expect, it } from "vitest";
import {
  calculatePlayableCardsForCurrentTurn,
  calculatePlayableCardsForCutIn,
} from "./playableCards";

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

describe("calculatePlayableCardsForCurrentTurn", () => {
  describe("通常の判定", () => {
    it("同色のカードは出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r5", "red", "5", 5));
      player.myHand.push(createCard("b3", "blue", "3", 3));

      const fieldCard = createCard("r7", "red", "7", 7);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("r5")).toBe(true);
      expect(player.playableCards.has("b3")).toBe(false);
    });

    it("同じ数字のカードは出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("b5", "blue", "5", 5));
      player.myHand.push(createCard("g3", "green", "3", 3));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("b5")).toBe(true);
      expect(player.playableCards.has("g3")).toBe(false);
    });

    it("ワイルドは常に出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("wild-1", "wild", "wild", 30));
      player.myHand.push(createCard("b3", "blue", "3", 3));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("wild-1")).toBe(true);
    });

    it("ドロー4は常に出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));
      player.myHand.push(createCard("b3", "blue", "3", 3)); // 上がり制限回避用

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("draw4-1")).toBe(true);
    });

    it("強制色変えは常に出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("force-blue", "blue", "force-change", 10));
      player.myHand.push(createCard("b3", "blue", "3", 3)); // 上がり制限回避用

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("force-blue")).toBe(true);
    });
  });

  describe("最初のカードがワイルドの場合", () => {
    it("全てのカードが出せる", () => {
      const state = createGameState();
      state.currentColor = "";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r5", "red", "5", 5));
      player.myHand.push(createCard("b3", "blue", "3", 3));
      player.myHand.push(createCard("g-skip", "green", "skip", 20));

      const fieldCard = createCard("wild-1", "wild", "wild", 30);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: true,
      });

      expect(player.playableCards.get("r5")).toBe(true);
      expect(player.playableCards.get("b3")).toBe(true);
      expect(player.playableCards.get("g-skip")).toBe(true);
    });
  });

  describe("ドロー累積中", () => {
    it("draw2の上にdraw2を出せる", () => {
      const state = createGameState();
      state.currentColor = "green";
      state.drawStack = 2;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r-draw2", "red", "draw2", 20));
      player.myHand.push(createCard("r5", "red", "5", 5));

      const fieldCard = createCard("g-draw2", "green", "draw2", 20);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("r-draw2")).toBe(true);
      expect(player.playableCards.has("r5")).toBe(false);
    });

    it("draw2の上にdraw4を出せる", () => {
      const state = createGameState();
      state.currentColor = "green";
      state.drawStack = 2;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));
      player.myHand.push(createCard("r5", "red", "5", 5));

      const fieldCard = createCard("g-draw2", "green", "draw2", 20);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("draw4-1")).toBe(true);
      expect(player.playableCards.has("r5")).toBe(false);
    });

    it("draw4の上にdraw4のみ出せる", () => {
      const state = createGameState();
      state.currentColor = "";
      state.drawStack = 4;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));
      player.myHand.push(createCard("r-draw2", "red", "draw2", 20));

      const fieldCard = createCard("draw4-2", "wild", "draw4", 50);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("draw4-1")).toBe(true);
      expect(player.playableCards.has("r-draw2")).toBe(false);
    });
  });

  describe("色選択待ち", () => {
    it("色選択待ち中は何も出せない", () => {
      const state = createGameState();
      state.currentColor = "";
      state.drawStack = 0;
      state.waitingForColorChoice = true;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r5", "red", "5", 5));
      player.myHand.push(createCard("wild-1", "wild", "wild", 30));

      const fieldCard = createCard("wild-2", "wild", "wild", 30);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("色選択待ち中はドロー累積中でも何も出せない", () => {
      const state = createGameState();
      state.currentColor = "";
      state.drawStack = 4;
      state.waitingForColorChoice = true;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));
      player.myHand.push(createCard("r5", "red", "5", 5));

      const fieldCard = createCard("draw4-2", "wild", "draw4", 50);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });
  });

  describe("上がり制限", () => {
    it("手札1枚で記号カードは出せない（skip）", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r-skip", "red", "skip", 20));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("手札1枚で記号カードは出せない（reverse）", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r-reverse", "red", "reverse", 20));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("手札1枚で記号カードは出せない（draw2）", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r-draw2", "red", "draw2", 20));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("手札1枚で記号カードは出せない（wild）", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("wild-1", "wild", "wild", 30));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("手札1枚で記号カードは出せない（draw4）", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("手札1枚で記号カードは出せない（force-change）", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("force-red", "red", "force-change", 10));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.size).toBe(0);
    });

    it("手札1枚で数字カードは出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r5", "red", "5", 5));

      const fieldCard = createCard("r7", "red", "7", 7);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("r5")).toBe(true);
    });

    it("手札2枚以上なら記号カードも出せる", () => {
      const state = createGameState();
      state.currentColor = "red";
      state.drawStack = 0;
      state.waitingForColorChoice = false;

      const player = createPlayer("p1", 1);
      player.myHand.push(createCard("r-skip", "red", "skip", 20));
      player.myHand.push(createCard("b3", "blue", "3", 3));

      const fieldCard = createCard("r5", "red", "5", 5);

      calculatePlayableCardsForCurrentTurn(state, player, fieldCard, {
        isFirstCardWild: false,
      });

      expect(player.playableCards.get("r-skip")).toBe(true);
    });
  });
});

describe("calculatePlayableCardsForCutIn", () => {
  it("同色・同数字のカードでカットインできる", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("r5", "red", "5", 5));
    player.myHand.push(createCard("r5-2", "red", "5", 5));
    player.myHand.push(createCard("b5", "blue", "5", 5));

    const fieldCard = createCard("r5-field", "red", "5", 5);

    calculatePlayableCardsForCutIn(player, fieldCard);

    expect(player.playableCards.get("r5")).toBe(true);
    expect(player.playableCards.get("r5-2")).toBe(true);
    expect(player.playableCards.has("b5")).toBe(false);
  });

  it("同色・同記号のカードでカットインできる", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("r-skip", "red", "skip", 20));
    player.myHand.push(createCard("b-skip", "blue", "skip", 20));

    const fieldCard = createCard("r-skip-field", "red", "skip", 20);

    calculatePlayableCardsForCutIn(player, fieldCard);

    expect(player.playableCards.get("r-skip")).toBe(true);
    expect(player.playableCards.has("b-skip")).toBe(false);
  });

  it("ワイルド同士でカットインできる", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("wild-1", "wild", "wild", 30));
    player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));

    const fieldCard = createCard("wild-field", "wild", "wild", 30);

    calculatePlayableCardsForCutIn(player, fieldCard);

    expect(player.playableCards.get("wild-1")).toBe(true);
    expect(player.playableCards.has("draw4-1")).toBe(false);
  });

  it("ドロー4同士でカットインできる", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("draw4-1", "wild", "draw4", 50));
    player.myHand.push(createCard("wild-1", "wild", "wild", 30));

    const fieldCard = createCard("draw4-field", "wild", "draw4", 50);

    calculatePlayableCardsForCutIn(player, fieldCard);

    expect(player.playableCards.get("draw4-1")).toBe(true);
    expect(player.playableCards.has("wild-1")).toBe(false);
  });

  it("強制色変え同士でカットインできる（色が違っても）", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("force-blue", "blue", "force-change", 10));
    player.myHand.push(createCard("force-green", "green", "force-change", 10));
    player.myHand.push(createCard("r5", "red", "5", 5));

    const fieldCard = createCard("force-red", "red", "force-change", 10);

    calculatePlayableCardsForCutIn(player, fieldCard);

    expect(player.playableCards.get("force-blue")).toBe(true);
    expect(player.playableCards.get("force-green")).toBe(true);
    expect(player.playableCards.has("r5")).toBe(false);
  });

  it("カットインできるカードがない場合は空", () => {
    const player = createPlayer("p1", 1);
    player.myHand.push(createCard("b3", "blue", "3", 3));
    player.myHand.push(createCard("g7", "green", "7", 7));

    const fieldCard = createCard("r5", "red", "5", 5);

    calculatePlayableCardsForCutIn(player, fieldCard);

    expect(player.playableCards.size).toBe(0);
  });
});
