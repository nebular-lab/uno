import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

describe("Test Environment Setup", () => {
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

  it("should boot the test server", () => {
    expect(colyseus).toBeDefined();
  });

  it("should create a game room", async () => {
    const room = await colyseus.createRoom("game", {});
    expect(room).toBeDefined();
    expect(room.roomId).toBeDefined();
  });

  it("should connect a client to the room", async () => {
    const room = await colyseus.createRoom("game", {});
    const client = await colyseus.connectTo(room, { playerName: "TestPlayer" });
    expect(client).toBeDefined();
    expect(room.state.players.size).toBe(1);
  });
});
