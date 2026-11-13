import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/contract/**/*.test.ts",
      "tests/shared/**/*.test.ts",
      "tests/cross-module/**/*.test.ts",
      "tests/db/**/*.test.ts",
    ],
    environment: "node",
  },
});
