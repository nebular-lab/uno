import { Card, GameState, Player } from "@dobon-uno/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { CardEffectContextFactory } from "./CardEffectContextFactory";

describe("CardEffectContextFactory", () => {
  let state: GameState;
  let factory: CardEffectContextFactory;

  beforeEach(() => {
    state = new GameState();
    state.phase = "playing";
    state.turnDirection = 1;

    // プレイヤーを追加（座席順: 1, 3, 5）
    const player1 = new Player();
    player1.sessionId = "player1";
    player1.seatId = 1;
    state.players.set("player1", player1);

    const player2 = new Player();
    player2.sessionId = "player2";
    player2.seatId = 3;
    state.players.set("player2", player2);

    const player3 = new Player();
    player3.sessionId = "player3";
    player3.seatId = 5;
    state.players.set("player3", player3);

    state.currentTurnPlayerId = "player1";

    factory = new CardEffectContextFactory(state);
  });

  describe("create", () => {
    it("正しいstateを含むコンテキストを作成する", () => {
      const card = new Card("card1", "red", "5", 5);
      const context = factory.create(card);

      expect(context.state).toBe(state);
    });

    it("正しいcardを含むコンテキストを作成する", () => {
      const card = new Card("card1", "red", "5", 5);
      const context = factory.create(card);

      expect(context.card).toBe(card);
    });

    it("getPlayersSortedBySeatが座席順でプレイヤーを返す", () => {
      const card = new Card("card1", "red", "5", 5);
      const context = factory.create(card);

      const sortedPlayers = context.getPlayersSortedBySeat();

      expect(sortedPlayers).toHaveLength(3);
      expect(sortedPlayers[0].seatId).toBe(1);
      expect(sortedPlayers[1].seatId).toBe(3);
      expect(sortedPlayers[2].seatId).toBe(5);
    });

    it("advanceToNextPlayerが正方向で次のプレイヤーに進める", () => {
      const card = new Card("card1", "red", "5", 5);
      const context = factory.create(card);

      expect(state.currentTurnPlayerId).toBe("player1");

      context.advanceToNextPlayer();

      expect(state.currentTurnPlayerId).toBe("player2");
    });

    it("advanceToNextPlayerが逆方向で前のプレイヤーに進める", () => {
      state.turnDirection = -1;
      const card = new Card("card1", "red", "5", 5);
      const context = factory.create(card);

      expect(state.currentTurnPlayerId).toBe("player1");

      context.advanceToNextPlayer();

      expect(state.currentTurnPlayerId).toBe("player3");
    });

    it("advanceToNextPlayerが最後のプレイヤーから最初に戻る", () => {
      state.currentTurnPlayerId = "player3";
      const card = new Card("card1", "red", "5", 5);
      const context = factory.create(card);

      context.advanceToNextPlayer();

      expect(state.currentTurnPlayerId).toBe("player1");
    });
  });
});
