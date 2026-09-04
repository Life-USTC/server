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
        statements: 60,
        branches: 53,
        functions: 60,
        lines: 62,
      },
    },
  },
  resolve: {
    alias: sharedAlias,
  },
});
