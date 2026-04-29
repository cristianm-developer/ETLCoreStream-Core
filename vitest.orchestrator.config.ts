import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
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
    include: ["src/core/orchestator/**/*.test.ts"],
  },
});
