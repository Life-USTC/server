import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("E2E full-suite parity orchestration", () => {
  test("package.json routes e2e:test through the CI-parity script", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["e2e:test"]).toBe(
      "bash tests/ci/e2e-full-suite-parity.sh",
    );
    expect(packageJson.scripts["e2e:test:shard8"]).toBe(
      "bash tests/ci/e2e-run-shard.sh 8/8",
    );
  });

  test("orchestration prepares roles once before all eight native shards", () => {
    const script = readFileSync(
      resolve(repoRoot, "tests/ci/e2e-full-suite-parity.sh"),
      "utf8",
    );

    expect(script).toContain("readonly E2E_SHARD_TOTAL=8");
    const setup = "source tests/ci/setup-runtime-database.sh";
    expect(script.split(setup)).toHaveLength(2);
    expect(script.indexOf(setup)).toBeLessThan(script.indexOf("for shard in"));
    expect(script).not.toMatch(/migrate reset|prisma db seed/);
    expect(script).toContain("bash tests/ci/e2e-run-shard.sh");
    expect(script).toContain("E2E_SHARD_TOTAL");
  });
});
