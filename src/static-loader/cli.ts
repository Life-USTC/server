import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { cleanupExpiredAuthRecords } from "./auth-record-cleanup";
import { runImport } from "./import";
import { createPrismaClient } from "./prisma";
import { Snapshot } from "./snapshot";
import {
  parseBooleanSetting,
  parseOptionalNonNegativeIntegerSetting,
  parseOptionalSha256Setting,
  parsePositiveIntegerSetting,
} from "./validation";

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function main() {
  const snapshotPath = getEnv("STATIC_SNAPSHOT_PATH");
  const minSemester = parsePositiveIntegerSetting(
    "STATIC_LOADER_MIN_SEMESTER",
    process.env.STATIC_LOADER_MIN_SEMESTER,
    401,
  );
  const dryRun = parseBooleanSetting(
    "STATIC_LOADER_DRY_RUN",
    process.env.STATIC_LOADER_DRY_RUN,
    false,
  );
  const bootstrapImportState = parseBooleanSetting(
    "STATIC_LOADER_BOOTSTRAP_IMPORT_STATE",
    process.env.STATIC_LOADER_BOOTSTRAP_IMPORT_STATE,
    false,
  );
  const retireMissingSections = parseBooleanSetting(
    "STATIC_LOADER_RETIRE_MISSING_SECTIONS",
    process.env.STATIC_LOADER_RETIRE_MISSING_SECTIONS,
    false,
  );
  const expectedSnapshotSha256 = parseOptionalSha256Setting(
    "STATIC_LOADER_EXPECTED_SNAPSHOT_SHA256",
    process.env.STATIC_LOADER_EXPECTED_SNAPSHOT_SHA256,
  );
  const expectedSectionRetirementCandidates =
    parseOptionalNonNegativeIntegerSetting(
      "STATIC_LOADER_EXPECTED_SECTION_RETIREMENT_CANDIDATES",
      process.env.STATIC_LOADER_EXPECTED_SECTION_RETIREMENT_CANDIDATES,
    );

  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${snapshotPath}`);
  }

  console.log(`snapshotPath: ${snapshotPath}`);
  console.log(`minSemester: ${minSemester}`);
  console.log(`dryRun: ${dryRun}`);
  console.log(`bootstrapImportState: ${bootstrapImportState}`);
  console.log(`retireMissingSections: ${retireMissingSections}`);
  console.log(
    `expectedSectionRetirementCandidates: ${expectedSectionRetirementCandidates ?? "not set"}`,
  );

  const snapshot = new Snapshot(snapshotPath);
  const metadata = snapshot.metadata();
  snapshot.close();
  const snapshotSha256 = await sha256File(snapshotPath);
  console.log("Snapshot metadata:", metadata);
  console.log(`Snapshot SHA-256: ${snapshotSha256}`);

  const prisma = createPrismaClient();

  try {
    if (!dryRun) {
      const authCleanupReport = await cleanupExpiredAuthRecords(prisma);
      console.log("Expired auth cleanup report:", authCleanupReport);
    }

    const report = await runImport(prisma, {
      snapshotPath,
      snapshotSha256,
      minSemester,
      dryRun,
      bootstrapImportState,
      retireMissingSections,
      expectedSnapshotSha256,
      expectedSectionRetirementCandidates,
    });
    console.log("Import report:", report);

    const statsFile = process.env.STATIC_LOADER_STATS_FILE;
    if (statsFile) {
      await writeFile(statsFile, JSON.stringify(report, null, 2));
    }
  } catch (error) {
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
