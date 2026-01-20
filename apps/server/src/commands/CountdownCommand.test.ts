import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

describe("CountdownCommand", () => {
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

  describe("フェーズ移行", () => {
    it("dealingフェーズ完了後にcountdownフェーズになる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "countdown" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.phase).toBe("countdown");
    });

    it("countdown完了後にrevealingフェーズに移行する", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "revealing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.phase).toBe("revealing");
    });
  });

  describe("カウントダウン値", () => {
    it("countdownが3から始まる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "countdown" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.countdown).toBe(3);
    });

    it("countdownが3→2→1→0と減少する", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "countdown" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const countdownValues: number[] = [room.state.countdown];
      while (
        room.state.phase === "countdown" &&
        room.state.countdown > 0 &&
        Date.now() < timeout
      ) {
        await room.waitForNextPatch();
        const currentValue = room.state.countdown;
        if (countdownValues[countdownValues.length - 1] !== currentValue) {
          countdownValues.push(currentValue);
        }
      }

      expect(countdownValues).toContain(3);
      expect(countdownValues).toContain(2);
      expect(countdownValues).toContain(1);
      expect(countdownValues).toContain(0);
    });
  });
});
