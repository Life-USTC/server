import "dotenv/config";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { runImport } from "./import";
import { createPrismaClient } from "./prisma";
import { Snapshot } from "./snapshot";
import { parseBooleanSetting, parsePositiveIntegerSetting } from "./validation";

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:\/\/([^:@]+)(:[^@]+)?@/, "://***@");
}

async function main() {
  const databaseUrl = getEnv("DATABASE_URL");
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

  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${snapshotPath}`);
  }

  console.log(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`snapshotPath: ${snapshotPath}`);
  console.log(`minSemester: ${minSemester}`);
  console.log(`dryRun: ${dryRun}`);

  const snapshot = new Snapshot(snapshotPath);
  const metadata = snapshot.metadata();
  snapshot.close();
  console.log("Snapshot metadata:", metadata);

  const prisma = createPrismaClient();

  try {
    const stats = await runImport(prisma, {
      snapshotPath,
      minSemester,
      dryRun,
    });
    console.log("Import stats:", stats);

    const statsFile = process.env.STATIC_LOADER_STATS_FILE;
    if (statsFile) {
      await writeFile(statsFile, JSON.stringify(stats, null, 2));
    }
  } catch (error) {
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
