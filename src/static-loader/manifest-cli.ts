import "dotenv/config";
import { completeImportCli } from "./import-cli";
import { runManifestImport } from "./manifest-import";
import { createPrismaClient } from "./prisma";
import { parseBooleanSetting } from "./validation";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Environment variable ${name} is required`);
  return value;
}

async function main() {
  const prisma = createPrismaClient();
  const dryRun = parseBooleanSetting(
    "STATIC_LOADER_DRY_RUN",
    process.env.STATIC_LOADER_DRY_RUN,
    false,
  );
  await completeImportCli(
    prisma,
    runManifestImport({
      prisma,
      manifestUrl: required("STATIC_SNAPSHOT_MANIFEST_URL"),
      cacheDir:
        process.env.STATIC_SNAPSHOT_CACHE_DIR?.trim() || ".static-snapshots",
      dryRun,
    }),
  );
}

main();
