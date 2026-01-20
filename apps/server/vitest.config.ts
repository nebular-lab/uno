import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Colyseusサーバーのポート競合を防ぐためシーケンシャル実行
    fileParallelism: false,
    // テスト環境を設定（タイミング高速化のため）
    env: {
      NODE_ENV: "test",
    },
    testTimeout: 15000,
  },
});
