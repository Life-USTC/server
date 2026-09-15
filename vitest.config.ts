import { defineConfig } from "vitest/config";
import { sharedAlias } from "./vitest.base";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reportOnFailure: true,
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**"],
      thresholds: {
        statements: 64,
        branches: 57,
        functions: 63,
        lines: 66,
        // Security regressions must not be offset by coverage in unrelated code.
        "src/features/subscriptions/server/subscription-write-model.ts": {
          lines: 98,
          branches: 92,
          functions: 100,
          statements: 98,
        },
        "src/features/oauth/server/user-authorizations.server.ts": {
          lines: 100,
          branches: 94,
          functions: 100,
          statements: 99,
        },
        "src/lib/db/prisma.ts": {
          lines: 85,
          branches: 68,
          functions: 93,
          statements: 81,
        },
        "src/lib/graphql/auth.ts": {
          lines: 88,
          branches: 86,
          functions: 87,
          statements: 89,
        },
        "src/lib/mcp/auth.ts": {
          lines: 92,
          branches: 90,
          functions: 100,
          statements: 93,
        },
        "src/lib/mcp/auth-token-verification.ts": {
          lines: 96,
          branches: 83,
          functions: 100,
          statements: 91,
        },
      },
    },
  },
  resolve: {
    alias: sharedAlias,
  },
});
