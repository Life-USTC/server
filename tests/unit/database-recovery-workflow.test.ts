import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("database recovery workflow safety", () => {
  it("serializes production writers behind the production environment", async () => {
    const [migrate, sync] = await Promise.all([
      readRepoFile(".github/workflows/db-migrate-deploy.yml"),
      readRepoFile(".github/workflows/static-sync.yml"),
    ]);

    for (const source of [migrate, sync]) {
      expect(source).toContain("group: production-database-writes");
      expect(source).toContain("queue: max");
      expect(source).not.toContain("cancel-in-progress");
      expect(source).toContain("environment: production");
    }
  });

  it("uses only isolated recovery secrets and uploads no artifacts", async () => {
    const workflow = await readRepoFile(
      ".github/workflows/recovery-drill-verify.yml",
    );

    expect(workflow).toContain("environment: database-recovery");
    expect(workflow).toContain("secrets.RECOVERY_DATABASE_URL");
    expect(workflow).toContain("secrets.RECOVERY_DRILL_GUARD");
    expect(workflow).not.toContain("secrets.DATABASE_URL");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).not.toMatch(/provider.*token/i);
    expect(workflow).toContain("^[0-9a-fA-F]{40}$");
    expect(workflow).toContain(
      "Allowlisted aggregate counts changed during the candidate migration.",
    );
    expect(
      workflow.indexOf("Validate immutable recovery evidence"),
    ).toBeLessThan(workflow.indexOf("Checkout candidate"));
    expect(workflow).toContain("steps.evidence.outputs.restore-point-utc");
  });

  it("never logs a DATABASE_URL-derived value", async () => {
    const [staticLoader, verifier] = await Promise.all([
      readRepoFile("src/static-loader/cli.ts"),
      readRepoFile("scripts/verify-restored-database.ts"),
    ]);

    expect(staticLoader).not.toContain("maskDatabaseUrl");
    expect(staticLoader).not.toMatch(/console\.log[^\n]*DATABASE_URL/);
    expect(verifier).not.toContain("process.env.DATABASE_URL");
    expect(verifier).not.toMatch(/console\.(log|error)[^\\n]*connectionString/);
  });
});
