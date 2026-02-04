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
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: [
        /^node:/,
        /^@colyseus/,
        /^colyseus/,
        /^@dobon-uno/,
        /^ai$/,
        /^@ai-sdk/,
        /^zod$/,
        /^express$/,
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
