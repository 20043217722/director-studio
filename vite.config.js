import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Gitee Pages / GitHub Pages 用 /<repo>/ 作为 base，本地开发用 ./
const BASE = process.env.DEPLOY === "pages" ? "/director-studio/" : "./";

export default defineConfig({
  plugins: [react(), basicSsl()],
  base: BASE,
  server: {
    port: 5174,
    https: true,
    host: "0.0.0.0",
    proxy: {},
  },
  build: { outDir: "dist" },
});
