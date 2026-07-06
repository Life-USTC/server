import "dotenv/config";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
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

async function downloadWithRetry(
  url: string,
  path: string,
  retries = 3,
): Promise<void> {
  const timeoutMs = 5 * 60 * 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(
        `Downloading snapshot from ${url} (attempt ${attempt}/${retries})`,
      );
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(
          `Failed to download snapshot: ${response.status} ${response.statusText}`,
        );
      }

      const buffer = await response.arrayBuffer();
      await writeFile(path, new Uint8Array(buffer));
      console.log(`Downloaded ${buffer.byteLength} bytes`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Download attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        const delay = 1000 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function resolveSnapshotPath(): Promise<{
  path: string;
  temporary: boolean;
}> {
  const localPath = process.env.STATIC_SNAPSHOT_PATH;
  if (localPath) {
    if (!existsSync(localPath)) {
      throw new Error(`STATIC_SNAPSHOT_PATH ${localPath} does not exist`);
    }
    console.log(`Using local snapshot: ${localPath}`);
    return { path: localPath, temporary: false };
  }

  const url = getEnv(
    "STATIC_SNAPSHOT_URL",
    "https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite",
  );
  const tempPath = `${tmpdir()}/life-ustc-static-${Date.now()}.sqlite`;
  await downloadWithRetry(url, tempPath);
  return { path: tempPath, temporary: true };
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:\/\/([^:@]+)(:[^@]+)?@/, "://***@");
}

async function main() {
  const databaseUrl = getEnv("DATABASE_URL");
  const { path: snapshotPath, temporary } = await resolveSnapshotPath();
  const minSemester = parseIntDefault(
    process.env.STATIC_LOADER_MIN_SEMESTER,
    401,
  );
  const dryRun = parseBool(process.env.STATIC_LOADER_DRY_RUN, false);

  console.log(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`minSemester: ${minSemester}`);
  console.log(`dryRun: ${dryRun}`);

  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  try {
    prisma = createPrismaClient();

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

    const statsFile = process.env.STATIC_LOADER_STATS_FILE;
    if (statsFile) {
      await writeFile(statsFile, JSON.stringify(stats, null, 2));
    }
  } catch (error) {
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
    if (temporary) {
      try {
        await rm(snapshotPath);
      } catch (cleanupError) {
        console.warn(
          `Failed to remove temporary snapshot ${snapshotPath}:`,
          cleanupError,
        );
      }
    }
  }
}

main();
