import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "off"
    }
  }
];
