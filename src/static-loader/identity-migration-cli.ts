import "dotenv/config";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  IdentityMigrationBlockedError,
  runIdentityMigration,
} from "./identity-migration/runner";
import type { IdentityMigrationPlan } from "./identity-migration/types";
import { createPrismaClient } from "./prisma";
import {
  parseBooleanSetting,
  parseOptionalSha256Setting,
  parsePositiveIntegerSetting,
} from "./validation";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

const MAX_REPORTED_BLOCKERS = 100;

function summarizePlan(plan: IdentityMigrationPlan) {
  return {
    report: plan.report,
    blockers: plan.blockers.slice(0, MAX_REPORTED_BLOCKERS),
    omittedBlockerCount: Math.max(
      0,
      plan.blockers.length - MAX_REPORTED_BLOCKERS,
    ),
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
  const minSemester = parsePositiveIntegerSetting(
    "STATIC_LOADER_MIN_SEMESTER",
    process.env.STATIC_LOADER_MIN_SEMESTER,
    401,
  );
  const prisma = createPrismaClient();
  try {
    const report = await runIdentityMigration(prisma, {
      snapshotPath,
      expectedSnapshotSha256,
      dryRun,
      minSemester,
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
