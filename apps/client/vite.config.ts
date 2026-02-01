import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    server: {
      port: Number(env.VITE_PORT) || 5173,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "Dobon UNO",
          short_name: "Dobon",
          description: "ドボン UNO - オンラインで遊べるカードゲーム",
          theme_color: "#1a1a2e",
          background_color: "#1a1a2e",
          display: "standalone",
          orientation: "landscape",
          start_url: "/",
          icons: [
            {
              src: "/dobon-uno-icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/dobon-uno-icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/dobon-uno-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
