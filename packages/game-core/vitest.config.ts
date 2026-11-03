import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // テスト環境を設定（タイミング高速化のため）
    env: {
      NODE_ENV: "test",
    },
    testTimeout: 15000,
  },
});
