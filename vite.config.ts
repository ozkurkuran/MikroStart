import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        newtab: resolve(rootDir, "pages/newtab.html"),
        dashboard: resolve(rootDir, "pages/dashboard.html"),
        sidepanel: resolve(rootDir, "pages/sidepanel.html"),
        options: resolve(rootDir, "pages/options.html"),
        offscreen: resolve(rootDir, "pages/offscreen.html"),
        "service-worker": resolve(rootDir, "src/entries/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "service-worker"
            ? "assets/service-worker.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
