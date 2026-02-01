import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../app.config";

let colyseus: ColyseusTestServer;

// ランダムポートを生成（並行実行時のポート競合を防ぐ）
function getRandomPort(): number {
  return Math.floor(Math.random() * (65535 - 10000)) + 10000;
}

/**
 * テストサーバーをランダムポートで起動する
 * 並行実行時のポート競合を防ぐため、各テストスイートで呼び出す
 */
export async function bootTestServer(): Promise<ColyseusTestServer> {
  const port = Number(process.env.TEST_PORT) || getRandomPort();
  return boot(appConfig, port);
}

export async function setupTestServer() {
  colyseus = await bootTestServer();
  return colyseus;
}

export async function shutdownTestServer() {
  await colyseus.shutdown();
}

export async function cleanupTestServer() {
  await colyseus.cleanup();
}

export { colyseus };
