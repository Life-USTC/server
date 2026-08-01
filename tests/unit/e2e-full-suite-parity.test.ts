import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("E2E full-suite parity orchestration", () => {
  test("package.json routes e2e:test through the CI-parity script", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["e2e:test"]).toBe(
      "bash tests/ci/e2e-full-suite-parity.sh",
    );
    expect(packageJson.scripts["e2e:test:shard4"]).toBe(
      "playwright test --shard=4/4",
    );
  });

  test("orchestration script reseeds before each shard", () => {
    const script = readFileSync(
      resolve(repoRoot, "tests/ci/e2e-full-suite-parity.sh"),
      "utf8",
    );

    expect(script).toContain("readonly E2E_SHARD_TOTAL=4");
    expect(script).toContain("bun run db:migrate:deploy");
    expect(script).toContain("bunx prisma db seed");
    expect(script).toContain("bunx playwright test --shard=");
    expect(script).toContain("E2E_SHARD_TOTAL");
  });
});
