import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gitee Pages / GitHub Pages 用 /<repo>/ 作为 base，本地开发用 ./
const BASE = process.env.DEPLOY === "pages" ? "/director-studio/" : "./";

// Inject build version + cache-bust all asset references
// Also copies index.html → 404.html for GitHub Pages SPA fallback
function buildVersionPlugin() {
  const ts = String(Date.now());
  return {
    name: "build-version",
    transformIndexHtml(html) {
      return html
        .replaceAll("BUILD_VER", ts)
        // Add cache-buster to module scripts to defeat browser HTTP cache
        .replace(/(src="\/director-studio\/assets\/[^"]+\.js")/g, `$1?v=${ts}`)
        .replace(/(href="\/director-studio\/assets\/[^"]+\.css")/g, `$1?v=${ts}`);
    },
    closeBundle() {
      // Copy index.html → 404.html for GitHub Pages SPA routing
      // This ensures refreshing on any path loads the SPA instead of showing GitHub's 404
      const dist = path.resolve(__dirname, "dist");
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
  plugins: [react(), basicSsl(), buildVersionPlugin()],
  base: BASE,
  server: {
    port: 5174,
    https: true,
    host: "0.0.0.0",
    proxy: {},
  },
  build: { outDir: "dist" },
});
