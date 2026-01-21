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
    it("3人でゲーム開始するとゲームが開始される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      // 一気に配布されるため、dealingまたはcountdownフェーズに移行
      expect(["dealing", "countdown"]).toContain(room.state.phase);
    });

    it("dealingRoundが7になる（一気に配布）", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      // 一気に配布されるためdealingRoundは7
      expect(room.state.dealingRound).toBe(7);
    });

    it("各プレイヤーに7枚ずつ配られる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      // 一気に配布されるため、すぐに全員の手札が7枚
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
