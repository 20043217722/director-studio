import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Gitee Pages / GitHub Pages 用 /<repo>/ 作为 base，本地开发用 ./
const BASE = process.env.DEPLOY === "pages" ? "/director-studio/" : "./";

// Inject build version into HTML for cache busting
function buildVersionPlugin() {
  return {
    name: "build-version",
    transformIndexHtml(html) {
      return html.replaceAll("BUILD_VER", String(Date.now()));
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
