import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// Dev-Proxy /api -> Fastify-Server, vermeidet CORS-Reibung in der Entwicklung
// (siehe docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md).
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // generateSW statt injectManifest: Workbox-Runtime wird lokal ins
      // Bundle geschrieben, kein CDN-Import (SPEC.md §6: keine Requests an
      // fremde Hosts) - nach jedem Build via `grep importScripts dist/sw.js`
      // verifiziert.
      strategies: "generateSW",
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "medi-journal",
        short_name: "Tagebuch",
        description: "Privates Medikations-Tagebuch",
        start_url: "/",
        display: "standalone",
        background_color: "#0d1117",
        theme_color: "#0d7377",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
