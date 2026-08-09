import "dotenv/config";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  IdentityMigrationBlockedError,
  runIdentityMigration,
} from "./identity-migration/runner";
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
    console.log(JSON.stringify(report, null, 2));
    const reportPath = process.env.STATIC_IDENTITY_MIGRATION_REPORT_FILE;
    if (reportPath) {
      await writeFile(reportPath, JSON.stringify(report, null, 2));
    }
  } catch (error) {
    if (error instanceof IdentityMigrationBlockedError) {
      console.error(JSON.stringify(error.plan, null, 2));
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Identity migration failed:", error);
  process.exitCode = 1;
});
