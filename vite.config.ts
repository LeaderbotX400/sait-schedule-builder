import { fileURLToPath, URL } from "node:url";
import { VueMcp } from "vite-plugin-vue-mcp";

import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import vueDevTools from "vite-plugin-vue-devtools";
import manifest from "./manifest.config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss(), crx({ manifest }), VueMcp()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    cors: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { app: "index.html" },
    },
    sourcemap: true,
  },
});
