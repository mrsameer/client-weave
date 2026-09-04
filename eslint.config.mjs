import js from "@eslint/js";
import next from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next
];

export default config;
