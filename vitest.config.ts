import { defineConfig } from "vitest/config";
import { sharedAlias } from "./vitest.base";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**"],
      thresholds: {
        statements: 64,
        branches: 57,
        functions: 63,
        lines: 66,
      },
    },
  },
  resolve: {
    alias: sharedAlias,
  },
});
