import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectImplementedRestRoutes } from "../../tools/dev/check/contracts";

describe("contract route parity check", () => {
  it("collects HEAD and OPTIONS route exports", () => {
    const originalCwd = process.cwd();
    const fixtureRoot = join(
      originalCwd,
      "tests/unit/fixtures/contract-routes",
    );

    try {
      process.chdir(fixtureRoot);

      expect([...collectImplementedRestRoutes(["src/routes/api"])]).toEqual([
        "GET /api/parity",
        "HEAD /api/parity",
        "OPTIONS /api/parity",
      ]);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
