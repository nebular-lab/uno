import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

describe("StartGameCommand", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  describe("権限チェック", () => {
    it("オーナー以外は開始できない", async () => {
      const room = await colyseus.createRoom("game", {});
      await colyseus.connectTo(room, { playerName: "Owner" });
      const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      player2.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.phase).toBe("waiting");
    });

    it("3人未満では開始できない", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.phase).toBe("waiting");
    });

    it("waiting状態以外では開始できない", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // 1回目の開始
      owner.send("startGame");
      await room.waitForNextPatch();

      // 2回目の開始（すでにdealing状態）
      owner.send("startGame");
      await room.waitForNextPatch();

      // フェーズがリセットされていないこと
      expect(room.state.phase).not.toBe("waiting");
    });
  });

  describe("カード配布（dealingフェーズ）", () => {
    it("3人でゲーム開始するとdealingフェーズになる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.phase).toBe("dealing");
    });

    it("dealingRoundが1から始まり段階的に増える", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.dealingRound).toBeGreaterThanOrEqual(1);

      // dealingRoundが増えていくことを確認
      const rounds: number[] = [room.state.dealingRound];
      while (room.state.dealingRound < 7 && room.state.phase === "dealing") {
        await room.waitForNextPatch();
        if (!rounds.includes(room.state.dealingRound)) {
          rounds.push(room.state.dealingRound);
        }
      }

      expect(rounds).toContain(1);
      expect(rounds[rounds.length - 1]).toBe(7);
    });

    it("各プレイヤーに7枚ずつ配られる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      while (room.state.dealingRound < 7) {
        await room.waitForNextPatch();
      }

      for (const player of room.state.players.values()) {
        expect(player.handCount).toBe(7);
      }
    });

    it("山札枚数が正しい（112 - 7×プレイヤー数 - 1）", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      // dealingフェーズに入るまで待つ
      while (room.state.phase === "waiting") {
        await room.waitForNextPatch();
      }

      // dealingフェーズが終わるまで待つ
      while (room.state.phase === "dealing") {
        await room.waitForNextPatch();
      }

      // 112 - (7 × 3) - 1 = 90
      expect(room.state.deckCount).toBe(90);
    });

    it("最初のプレイヤーがcurrentTurnPlayerIdに設定される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(room.state.currentTurnPlayerId).toBeTruthy();
    });
  });
});
