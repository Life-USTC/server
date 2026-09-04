import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { sharedAlias } from "./vitest.base";

dotenv.config();

const sharedTest = {
  environment: "node" as const,
  globals: true,
  testTimeout: 30_000,
  hookTimeout: 30_000,
};

/** Integration DB + seed setup lives in `tests/integration/AGENTS.md`. */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: sharedAlias },
        test: {
          ...sharedTest,
          name: "integration-serial-auth",
          // Whole-table auth row counts flake when other files mutate auth tables.
          include: [
            "tests/integration/auth-record-cleanup.test.ts",
            "tests/integration/oauth-consent-transaction.test.ts",
          ],
          fileParallelism: false,
        },
      },
      {
        resolve: { alias: sharedAlias },
        test: {
          ...sharedTest,
          name: "integration-parallel",
          include: ["tests/integration/**/*.test.ts"],
          exclude: [
            "tests/integration/auth-record-cleanup.test.ts",
            "tests/integration/oauth-consent-transaction.test.ts",
          ],
          fileParallelism: true,
        },
      },
    ],
  },
});
