import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";
import prettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Reglas de Clean Code
      "no-console": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "error",

      // Limpieza automática de imports
      "unused-imports/no-unused-imports": "error",

      // Reglas para evitar errores en Streams/Async
      "no-async-promise-executor": "error",
      "no-await-in-loop": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "preserve-caught-error": "off",

      // Prettier
      "prettier/prettier": "warn",
    },
  },
  {
    // Ignorar archivos de build y config
    ignores: [
      "dist/**",
      "node_modules/**",
      "vite.config.ts",
      "eslint.config.js",
      "**/*.test.ts",
      "**/*.spec.ts",
    ],
  }
);
