import {
  CATALOG_EDGE_CACHE_TAG,
  purgePublicCatalogCaches,
} from "./edge-cache-purge";
import { parseBooleanSetting } from "./validation";

/** Local-only opt-in; production sync must configure both purge layers. */
export const ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE_ENV =
  "ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE";

function allowSkippingPostImportCachePurge(): boolean {
  return parseBooleanSetting(
    ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE_ENV,
    process.env[ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE_ENV],
    false,
  );
}

export type CachePurgeLayerOutcome =
  | "failed"
  | "not-run"
  | "purged"
  | "skipped";

export type PostImportCachePurgeReport = {
  /** Cloudflare zone/CDN cache, driven by `Cloudflare-CDN-Cache-Control`. */
  zone: CachePurgeLayerOutcome;
  /** Workers entrypoint cache for public SSR HTML, driven by `Cache-Control`. */
  workerEntrypoint: CachePurgeLayerOutcome;
  /** True when a layer that was configured to be purged did not get purged. */
  failed: boolean;
};

type Logger = {
  error: (message: string, error?: unknown) => void;
  log: (message: string) => void;
};

const consoleLogger: Logger = {
  error: (message, error) => {
    if (error === undefined) console.error(message);
    else console.error(message, error);
  },
  log: (message) => console.log(message),
};

async function runLayer(
  layer: string,
  purge: () => Promise<{ skipped: boolean }>,
  skippedHint: string,
  logger: Logger,
  allowSkip: boolean,
): Promise<CachePurgeLayerOutcome> {
  try {
    const result = await purge();
    if (result.skipped) {
      if (!allowSkip) {
        logger.error(
          `FAILED ${layer} cache purge after a committed import (${skippedHint})`,
        );
        return "failed";
      }
      logger.log(`Skipped ${layer} cache purge (${skippedHint})`);
      return "skipped";
    }
    logger.log(`Purged ${layer} cache for tag: ${CATALOG_EDGE_CACHE_TAG}`);
    return "purged";
  } catch (error) {
    // The import has already committed at this point. A silent purge failure
    // would leave the edge serving the previous catalog HTML for the whole
    // shared-cache TTL, so this has to be loud and has to fail the run.
    logger.error(`FAILED ${layer} cache purge after a committed import`, error);
    return "failed";
  }
}

/**
 * Invalidate every cache layer that can hold catalog responses.
 *
 * The authenticated Worker endpoint purges the independent zone and entrypoint
 * layers. It answers success only after both succeed, keeping Cloudflare
 * management credentials out of the importer.
 *
 * A repeated apply must retry invalidation after an earlier purge failure.
 * Only rolled-back (dry-run) imports skip purging.
 */
export async function runPostImportCachePurge(
  report: { outcome: "committed" | "rolled-back" | "unchanged" },
  logger: Logger = consoleLogger,
): Promise<PostImportCachePurgeReport> {
  if (report.outcome === "rolled-back") {
    return { failed: false, workerEntrypoint: "not-run", zone: "not-run" };
  }

  const allowSkip = allowSkippingPostImportCachePurge();

  const outcome = await runLayer(
    "Cloudflare zone/CDN and Workers entrypoint",
    purgePublicCatalogCaches,
    "APP_PUBLIC_ORIGIN or EDGE_CACHE_PURGE_SECRET not set",
    logger,
    allowSkip,
  );

  return {
    failed: outcome === "failed",
    workerEntrypoint: outcome,
    zone: outcome,
  };
}
