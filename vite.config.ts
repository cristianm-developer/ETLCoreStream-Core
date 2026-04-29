import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  plugins: [],
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
    minify: 'terser',
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "import-sheet",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["papaparse", "rxjs"],      
      output: {                
        globals: {
          papaparse: "Papa",
          rxjs: "RxJS",
        },
      },
    },
    sourcemap: false,
    emptyOutDir: true
  }
});