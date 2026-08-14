import { defineConfig } from "vitest/config";
import { sharedAlias } from "./vitest.base";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**"],
      thresholds: {
        statements: 55,
        branches: 48,
        functions: 55,
        lines: 57,
      },
    },
  },
  resolve: {
    alias: sharedAlias,
  },
});
