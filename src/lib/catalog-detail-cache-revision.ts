import {
  getCloudflareRuntimeContext,
  runCloudflareTraceSpan,
} from "@/lib/adapters/cloudflare-runtime";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";

// Bump whenever a cached catalog payload changes shape or ordering, even if source data is unchanged.
// Shared by list/detail L1, colo, and KV keys; never reuse an older payload revision.
const CATALOG_PAYLOAD_SCHEMA_REVISION = "schema2";
const BOOTSTRAP_REVISION = "bootstrap";

const revisionRequestCacheKey = Symbol("catalog-detail-revision");

/** Memoize only within this request; a new render must see committed imports. */
export function getCatalogDetailCacheRevision(): Promise<string> {
  const cache = getCloudflareRuntimeContext()?.cache;
  const existing = cache?.get(revisionRequestCacheKey) as
    | Promise<string>
    | undefined;
  if (existing) return existing;
  const revision = loadCatalogDetailCacheRevision().catch((error) => {
    cache?.delete(revisionRequestCacheKey);
    throw error;
  });
  cache?.set(revisionRequestCacheKey, revision);
  return revision;
}

async function loadCatalogDetailCacheRevision() {
  const state = await runCloudflareTraceSpan(
    "cache.catalog_revision.read",
    {
      "cache.layer": "origin",
      "cache.namespace": "catalog:revision",
    },
    async (span) => {
      try {
        // Even a data-cache hit needs this fresh revision. Use the driver
        // directly so that read does not deserialize the full Prisma schema.
        const state = await withRuntimeDatabaseAdapter(
          "app",
          async (adapter) => {
            const result = await adapter.queryRaw({
              sql: 'SELECT "snapshotSha256", "updatedAt" FROM "StaticImportState" WHERE "id" = $1',
              args: ["global"],
              argTypes: [{ scalarType: "string", arity: "scalar" }],
            });
            const row = result.rows[0] as [string, string] | undefined;
            if (!row) return null;
            // PrismaPg normalizes PostgreSQL timestamps to UTC strings.
            const updatedAt = new Date(row[1]);
            if (!Number.isFinite(updatedAt.getTime())) {
              throw new Error("Invalid catalog revision timestamp");
            }
            return { snapshotSha256: row[0], updatedAt };
          },
        );
        span?.setAttribute("cache.outcome", "success");
        return state;
      } catch (error) {
        span?.setAttribute("cache.outcome", "error");
        throw error;
      }
    },
  );
  const dataRevision = state
    ? `${state.snapshotSha256.slice(0, 16)}-${state.updatedAt.getTime().toString(36)}`
    : BOOTSTRAP_REVISION;
  const value = `${CATALOG_PAYLOAD_SCHEMA_REVISION}:${dataRevision}`;
  return value;
}
