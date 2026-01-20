import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../app.config";

let colyseus: ColyseusTestServer;

export async function setupTestServer() {
  colyseus = await boot(appConfig);
  return colyseus;
}

export async function shutdownTestServer() {
  await colyseus.shutdown();
}

export async function cleanupTestServer() {
  await colyseus.cleanup();
}

export { colyseus };
