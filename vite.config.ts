import { defineConfig } from "vitest/config";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@core": resolve(__dirname, "src/core"),
      "@shared": resolve(__dirname, "src/shared"),
      "@schemes": resolve(__dirname, "src/schemes"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
  build: {
    minify: "terser",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ETLCoreStream",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "xstate",
        "rxjs",
        "papaparse",
        "@preact/signals-core",
        "@xstate/graph",
      ],
    },
    sourcemap: false,
    emptyOutDir: true,
  },
});