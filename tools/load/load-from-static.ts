import { createToolPrisma } from "../shared/tool-prisma";
import { importStaticBusData } from "./static-bus-import";
import { importStaticCourses } from "./static-course-import";
import {
  parseStaticLoaderOptions,
  staticLoaderUsage,
} from "./static-loader-options";
import { StaticSnapshot } from "./static-snapshot";
import { downloadStaticSnapshot } from "./static-snapshot-source";

const options = parseStaticLoaderOptions();

if (options.help) {
  console.log(staticLoaderUsage());
  process.exit(0);
}

const prisma = createToolPrisma();

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warning: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

async function main() {
  try {
    logger.info(
      `Starting data load (min semester code: ${options.minSemesterJwId})`,
    );
    logger.info("Downloading static snapshot...");
    const snapshotPath = await downloadStaticSnapshot(options.cacheDir, logger);
    const snapshot = new StaticSnapshot(snapshotPath);
    logger.info(`Static snapshot at: ${snapshotPath}`);

    try {
      snapshot.assertSupportedSchema();
      const generatedAt = snapshot.getMetadata("generated_at");
      if (generatedAt) {
        logger.info(`Snapshot generated at: ${generatedAt}`);
      }

      if (!options.skipCourses) {
        await importStaticCourses(
          prisma,
          snapshot,
          options.minSemesterJwId,
          logger,
        );
      } else {
        logger.info("Skipping course data (--skip-courses)");
      }

      if (!options.skipBus) {
        await importStaticBusData(prisma, snapshot, logger);
      } else {
        logger.info("Skipping bus data (--skip-bus)");
      }
    } finally {
      snapshot.close();
    }

    logger.info("All data load complete!");
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Fatal error: ${err.message}`);
    if (err.stack) {
      logger.error(`Stack trace: ${err.stack}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
