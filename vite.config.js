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
  build: {
    outDir: "dist",
    target: "es2020",
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          // 分离 React 核心 (~120KB)
          "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
          // 分离 ReactFlow 画布 (懒加载·仅画布模式使用)
          "vendor-flow": ["@xyflow/react"],
          // 分离 Agent 提示词 (~80KB·不常变·强缓存·独立chunk利用浏览器缓存)
          "agent-prompts": ["./src/lib/agentPrompts.js"],
        },
        // 资源文件命名: 哈希用于缓存破坏
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    // 提高 chunk 大小警告阈值
    chunkSizeWarningLimit: 600,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 资源内联阈值 (4KB以下内联为base64·减少HTTP请求)
    assetsInlineLimit: 4096,
  },
});
