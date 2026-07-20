import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// Dev-Proxy /api -> Fastify-Server, vermeidet CORS-Reibung in der Entwicklung
// (siehe docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md).
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // injectManifest statt generateSW (M5b): eigene push/notificationclick-
      // Handler in app/src/sw.ts brauchen einen eigenen Service-Worker-
      // Quelltext, den Workbox nicht mehr generieren kann. Workbox-Pakete
      // bleiben trotzdem npm-Importe, die Vite/Rollup lokal ins Bundle
      // schreibt - kein CDN-Import (SPEC.md §6) - nach jedem Build weiter
      // via `grep importScripts dist/sw.js` verifiziert.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
      injectManifest: {
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
