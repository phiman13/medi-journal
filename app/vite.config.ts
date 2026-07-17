import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Dev-Proxy /api -> Fastify-Server, vermeidet CORS-Reibung in der Entwicklung
// (siehe docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md).
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
