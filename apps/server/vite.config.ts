import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "build",
    ssr: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [
        /^node:/,
        /^@colyseus/,
        /^colyseus/,
        // game-core は TypeScript のまま公開しているのでバンドルに含める
        /^@dobon-uno\/shared/,
        /^express$/,
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
