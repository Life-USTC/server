import {
  CATALOG_EDGE_CACHE_TAG,
  purgeCloudflareCacheByTags,
  purgeWorkerEntrypointCache,
} from "./edge-cache-purge";

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
): Promise<CachePurgeLayerOutcome> {
  try {
    const result = await purge();
    if (result.skipped) {
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
 * The two layers are independent: the zone purge cannot reach the Workers
 * entrypoint cache and the entrypoint purge cannot reach the zone. Both run,
 * and a failure in either one is reported rather than swallowed.
 *
 * Only a committed import changes what the caches should serve, so an
 * `unchanged` or `rolled-back` run purges nothing.
 */
export async function runPostImportCachePurge(
  report: { outcome: "committed" | "rolled-back" | "unchanged" },
  logger: Logger = consoleLogger,
): Promise<PostImportCachePurgeReport> {
  if (report.outcome !== "committed") {
    return { failed: false, workerEntrypoint: "not-run", zone: "not-run" };
  }

  const zone = await runLayer(
    "Cloudflare zone/CDN",
    () => purgeCloudflareCacheByTags([CATALOG_EDGE_CACHE_TAG]),
    "CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set",
    logger,
  );
  const workerEntrypoint = await runLayer(
    "Workers entrypoint (public SSR)",
    purgeWorkerEntrypointCache,
    "APP_PUBLIC_ORIGIN or EDGE_CACHE_PURGE_SECRET not set",
    logger,
  );

  return {
    failed: zone === "failed" || workerEntrypoint === "failed",
    workerEntrypoint,
    zone,
  };
}
