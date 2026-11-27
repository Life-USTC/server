import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { runImport } from "./import";
import { completeImportCli } from "./import-cli";
import { createPrismaClient } from "./prisma";
import { Snapshot } from "./snapshot";
import { parseBooleanSetting } from "./validation";

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

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function main() {
  const databaseUrl = getEnv("DATABASE_URL");
  const snapshotPath = getEnv("STATIC_SNAPSHOT_PATH");
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
  console.log(`dryRun: ${dryRun}`);

  const snapshot = new Snapshot(snapshotPath);
  const metadata = snapshot.metadata();
  snapshot.close();
  const snapshotSha256 = await sha256File(snapshotPath);
  console.log("Snapshot metadata:", metadata);
  console.log(`Snapshot SHA-256: ${snapshotSha256}`);

  const prisma = createPrismaClient();
  await completeImportCli(
    prisma,
    runImport(prisma, {
      snapshotPath,
      snapshotSha256,
      dryRun,
    }),
  );
}

main();
