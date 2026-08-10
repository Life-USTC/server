import "dotenv/config";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  IdentityMigrationBlockedError,
  runIdentityMigration,
} from "./identity-migration/runner";
import type { IdentityMigrationPlan } from "./identity-migration/types";
import { createPrismaClient } from "./prisma";
import { parseBooleanSetting, parseOptionalSha256Setting } from "./validation";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function summarizePlan(plan: IdentityMigrationPlan) {
  const blockersByCode = new Map<
    string,
    { count: number; example: (typeof plan.blockers)[number] }
  >();
  for (const blocker of plan.blockers) {
    const existing = blockersByCode.get(blocker.code);
    if (existing == null) {
      blockersByCode.set(blocker.code, { count: 1, example: blocker });
    } else {
      existing.count += 1;
    }
  }
  const blockerGroups = [...blockersByCode.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return {
    report: plan.report,
    blockerCountsByCode: Object.fromEntries(
      blockerGroups.map(([code, group]) => [code, group.count]),
    ),
    blockerExamples: blockerGroups.map(([, group]) => group.example),
  };
}

async function writeReport(report: unknown) {
  const serialized = JSON.stringify(report, null, 2);
  console.log(serialized);
  const reportPath = process.env.STATIC_IDENTITY_MIGRATION_REPORT_FILE;
  if (reportPath) await writeFile(reportPath, serialized);
}

async function main() {
  const snapshotPath = requiredEnvironment("STATIC_SNAPSHOT_PATH");
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${snapshotPath}`);
  }
  const expectedSnapshotSha256 = parseOptionalSha256Setting(
    "STATIC_IDENTITY_MIGRATION_EXPECTED_SNAPSHOT_SHA256",
    process.env.STATIC_IDENTITY_MIGRATION_EXPECTED_SNAPSHOT_SHA256,
  );
  if (expectedSnapshotSha256 == null) {
    throw new Error(
      "STATIC_IDENTITY_MIGRATION_EXPECTED_SNAPSHOT_SHA256 is required",
    );
  }
  const dryRun = parseBooleanSetting(
    "STATIC_IDENTITY_MIGRATION_DRY_RUN",
    process.env.STATIC_IDENTITY_MIGRATION_DRY_RUN,
    true,
  );
  const prisma = createPrismaClient();
  try {
    const report = await runIdentityMigration(prisma, {
      snapshotPath,
      expectedSnapshotSha256,
      dryRun,
    });
    await writeReport({
      mode: report.mode,
      outcome: report.outcome,
      ...summarizePlan(report.plan),
      applied: report.applied,
    });
  } catch (error) {
    if (error instanceof IdentityMigrationBlockedError) {
      await writeReport({
        mode: dryRun ? "dry-run" : "apply",
        outcome: "blocked",
        ...summarizePlan(error.plan),
        applied: null,
      });
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    "Identity migration failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
