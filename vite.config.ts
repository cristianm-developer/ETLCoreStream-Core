import { defineConfig } from "vitest/config";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import { viteStaticCopy } from "vite-plugin-static-copy";
import eslint from "vite-plugin-eslint";

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: "./tsconfig.json",
      rollupTypes: false,
      insertTypesEntry: false,
      include: ["src/**/*.ts"],
      skipDiagnostics: true,
      outDir: "dist",
      entryRoot: "src",
    }),
    eslint(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@core": resolve(__dirname, "src/core"),
      "@shared": resolve(__dirname, "src/shared"),
      "@schemes": resolve(__dirname, "src/shared/schemes"),
      "@examples": resolve(__dirname, "src/examples"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
  build: {
    minify: false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ETLCoreStream",
      fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["xstate", "rxjs", "papaparse", "@preact/signals-core", "@xstate/graph"],
      output: {
        exports: "named",
      },
    },
    sourcemap: false,
    emptyOutDir: true,
  },
});
