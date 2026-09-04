import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolve = { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } };

export default defineConfig({
  resolve,
  test: {
    projects: [
      { resolve, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { resolve, test: { name: "property", include: ["tests/property/**/*.test.ts"] } },
      { resolve, test: { name: "integration", include: ["tests/integration/**/*.test.ts"] } },
      { resolve, test: { name: "contract", include: ["tests/contract/**/*.test.ts"] } },
      { resolve, test: { name: "concurrency", include: ["tests/concurrency/**/*.test.ts"] } },
      {
        resolve,
        test: {
          name: "webmcp",
          include: ["tests/webmcp/**/*.test.ts", "tests/webmcp/**/*.spec.ts"]
        }
      },
      { resolve, test: { name: "security", include: ["tests/security/**/*.test.ts"] } }
    ]
  }
});
