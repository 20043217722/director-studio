import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildVersionPlugin() {
  const ts = String(Date.now());
  return {
    name: "build-version",
    transformIndexHtml(html) {
      return html
        .replaceAll("BUILD_VER", ts)
        .replaceAll("/director-studio/", "./");
    },
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      // Replace __BUILD_TS__ in service worker with build timestamp
      const swPath = path.join(dist, "sw.js");
      if (fs.existsSync(swPath)) {
        let sw = fs.readFileSync(swPath, "utf-8");
        sw = sw.replaceAll("__BUILD_TS__", ts);
        fs.writeFileSync(swPath, sw);
        console.log("✓ sw.js cache version patched with build ts");
      }
      const src = path.join(dist, "index.html");
      const dst = path.join(dist, "404.html");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        console.log("✓ 404.html created (SPA fallback for GitHub Pages)");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), buildVersionPlugin()],
  base: "./",
  server: {
    port: 5174,
    host: "0.0.0.0",
    proxy: {},
  },
  build: { outDir: "dist" },
});
