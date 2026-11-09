import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `--mode mock` runs the React app alone with fictional data and the dev role bar (src/dev),
// so it needs no Worker, D1 database, or local secrets.
export default defineConfig(({ mode }) => ({
  plugins: mode === "mock" ? [react()] : [react(), cloudflare()],
  ...(mode === "mock" ? { build: { outDir: "dist-mock" } } : {}),
}));
