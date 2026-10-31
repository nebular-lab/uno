import { Card, GameState, Player } from "@dobon-uno/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateTotalHandPoints,
  createGameResult,
  FINISH_DISPLAY_DURATION,
  HAND_REVEAL_DURATION,
  RESULT_DISPLAY_DURATION,
  revealHand,
  SCORE_DISPLAY_DURATION,
} from "./finishGame";

describe("finishGame ユーティリティ", () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
    state.phase = "playing";
  });

  /**
   * プレイヤーを作成するヘルパー
   */
  function createPlayer(sessionId: string, handPoints: number[]): Player {
    const player = new Player();
    player.sessionId = sessionId;

    for (let i = 0; i < handPoints.length; i++) {
      const card = new Card(
        `${sessionId}-card-${i}`,
        "red",
        String(handPoints[i]),
        handPoints[i],
      );
      player.myHand.push(card);
    }

    player.handCount = player.myHand.length;
    return player;
  }

  describe("calculateTotalHandPoints", () => {
    it("全プレイヤーの手札合計点数を計算する", () => {
      // A: 10点, B: 20点, C: 30点
      state.players.set("playerA", createPlayer("playerA", [5, 5])); // 10点
      state.players.set("playerB", createPlayer("playerB", [10, 10])); // 20点
      state.players.set("playerC", createPlayer("playerC", [10, 20])); // 30点

      const total = calculateTotalHandPoints(state);
      expect(total).toBe(60);
    });

    it("特定プレイヤーを除外して計算できる", () => {
      state.players.set("playerA", createPlayer("playerA", [5, 5])); // 10点
      state.players.set("playerB", createPlayer("playerB", [10, 10])); // 20点
      state.players.set("playerC", createPlayer("playerC", [10, 20])); // 30点

      // playerAを除外
      const total = calculateTotalHandPoints(state, ["playerA"]);
      expect(total).toBe(50); // B + C = 50
    });

    it("複数プレイヤーを除外して計算できる", () => {
      state.players.set("playerA", createPlayer("playerA", [5, 5])); // 10点
      state.players.set("playerB", createPlayer("playerB", [10, 10])); // 20点
      state.players.set("playerC", createPlayer("playerC", [10, 20])); // 30点

      // playerAとplayerBを除外
      const total = calculateTotalHandPoints(state, ["playerA", "playerB"]);
      expect(total).toBe(30); // C のみ
    });

    it("手札が空のプレイヤーは0点として計算される", () => {
      state.players.set("playerA", createPlayer("playerA", [])); // 0点
      state.players.set("playerB", createPlayer("playerB", [10, 10])); // 20点

      const total = calculateTotalHandPoints(state);
      expect(total).toBe(20);
    });
  });

  describe("createGameResult", () => {
    it("GameResultを正しく作成する", () => {
      const scoreChanges = new Map<string, number>();
      scoreChanges.set("playerA", 100);
      scoreChanges.set("playerB", -50);
      scoreChanges.set("playerC", -50);

      const result = createGameResult(state, "playerA", "normal", scoreChanges);

      expect(result.gameNumber).toBe(1);
      expect(result.winnerId).toBe("playerA");
      expect(result.finishType).toBe("normal");
      expect(result.scoreChanges.get("playerA")).toBe(100);
      expect(result.scoreChanges.get("playerB")).toBe(-50);
      expect(result.scoreChanges.get("playerC")).toBe(-50);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("gameHistoryの長さに応じてgameNumberが設定される", () => {
      // 既に2ゲーム終了している状態を模擬
      state.gameHistory.push(createGameResult(state, "x", "normal", new Map()));
      state.gameHistory.push(createGameResult(state, "y", "normal", new Map()));

      const scoreChanges = new Map<string, number>();
      const result = createGameResult(state, "playerA", "dobon", scoreChanges);

      expect(result.gameNumber).toBe(3);
    });

    it("finishTypeが正しく設定される", () => {
      const scoreChanges = new Map<string, number>();

      const normalResult = createGameResult(
        state,
        "playerA",
        "normal",
        scoreChanges,
      );
      expect(normalResult.finishType).toBe("normal");

      const dobonResult = createGameResult(
        state,
        "playerA",
        "dobon",
        scoreChanges,
      );
      expect(dobonResult.finishType).toBe("dobon");

      const dobonReturnResult = createGameResult(
        state,
        "playerA",
        "dobonReturn",
        scoreChanges,
      );
      expect(dobonReturnResult.finishType).toBe("dobonReturn");
    });
  });

  describe("revealHand", () => {
    it("revealHandでプレイヤーの手札がrevealedHandにコピーされる", () => {
      const player = createPlayer("playerA", [3, 7]);

      revealHand(player);

      expect(player.revealedHand.map((c) => c.id)).toEqual([
        "playerA-card-0",
        "playerA-card-1",
      ]);
      expect(player.revealedHand.map((c) => c.points)).toEqual([3, 7]);
    });

    it("revealHandを再度呼ぶと最新の手札で置き換わる", () => {
      const player = createPlayer("playerA", [3, 7]);
      revealHand(player);

      player.myHand.pop();
      revealHand(player);

      expect(player.revealedHand.length).toBe(1);
    });
  });

  describe("定数", () => {
    it("FINISH_DISPLAY_DURATIONは1500ms", () => {
      expect(FINISH_DISPLAY_DURATION).toBe(1500);
    });

    it("HAND_REVEAL_DURATIONは3500ms", () => {
      expect(HAND_REVEAL_DURATION).toBe(3500);
    });

    it("SCORE_DISPLAY_DURATIONは5000ms", () => {
      expect(SCORE_DISPLAY_DURATION).toBe(5000);
    });

    it("RESULT_DISPLAY_DURATIONは10000ms（1500 + 3500 + 5000）", () => {
      expect(RESULT_DISPLAY_DURATION).toBe(10000);
    });
  });
});
