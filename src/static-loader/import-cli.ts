import { writeFile } from "node:fs/promises";
import type { PrismaClient } from "../generated/prisma-node/client";
import type { ImportReport } from "./import-types";
import { purgeImportGeneration } from "./purge-import-generation";

export async function completeImportCli(
  prisma: PrismaClient,
  pending: Promise<ImportReport>,
) {
  try {
    const report = await pending;
    console.log("Import report:", report);
    const statsFile = process.env.STATIC_LOADER_STATS_FILE;
    if (statsFile) {
      await writeFile(statsFile, JSON.stringify(report, null, 2));
    }
    const purge = await purgeImportGeneration(prisma, report);
    if (purge.failed) process.exitCode = 1;
  } catch (error) {
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
