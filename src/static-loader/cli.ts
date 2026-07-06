import "dotenv/config";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { runImport } from "./import";
import { createPrismaClient } from "./prisma";
import { Snapshot } from "./snapshot";

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const lower = value.trim().toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return defaultValue;
}

function parseIntDefault(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

async function resolveSnapshotPath(): Promise<string> {
  const localPath = process.env.STATIC_SNAPSHOT_PATH;
  if (localPath && existsSync(localPath)) {
    console.log(`Using local snapshot: ${localPath}`);
    return localPath;
  }
  if (localPath) {
    console.warn(
      `STATIC_SNAPSHOT_PATH ${localPath} does not exist, falling back to download`,
    );
  }

  const url = getEnv(
    "STATIC_SNAPSHOT_URL",
    "https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite",
  );
  const tempPath = `${tmpdir()}/life-ustc-static-${Date.now()}.sqlite`;
  console.log(`Downloading snapshot from ${url} to ${tempPath}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download snapshot: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  await writeFile(tempPath, new Uint8Array(buffer));
  console.log(`Downloaded ${buffer.byteLength} bytes`);
  return tempPath;
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:\/\/[^:]+:[^@]+@/, "://***@");
}

async function main() {
  const databaseUrl = getEnv("DATABASE_URL");
  const snapshotPath = await resolveSnapshotPath();
  const minSemester = parseIntDefault(
    process.env.STATIC_LOADER_MIN_SEMESTER,
    401,
  );
  const dryRun = parseBool(process.env.STATIC_LOADER_DRY_RUN, false);

  console.log(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`minSemester: ${minSemester}`);
  console.log(`dryRun: ${dryRun}`);

  const prisma = createPrismaClient();

  try {
    const snapshot = new Snapshot(snapshotPath);
    const metadata = snapshot.metadata();
    snapshot.close();
    console.log("Snapshot metadata:", metadata);

    const stats = await runImport(prisma, {
      snapshotPath,
      minSemester,
      dryRun,
    });
    console.log("Import stats:", stats);
  } catch (error) {
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
