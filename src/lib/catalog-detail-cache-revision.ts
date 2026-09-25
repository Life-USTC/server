import {
  getCloudflareRuntimeContext,
  runCloudflareTraceSpan,
} from "@/lib/adapters/cloudflare-runtime";
import { prisma } from "@/lib/db/prisma";

// Bump whenever a cached catalog payload changes shape, even if source data is unchanged.
// Shared by list/detail L1, colo, and KV keys; never reuse an older payload revision.
const CATALOG_PAYLOAD_SCHEMA_REVISION = "schema1";
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
        const state = await prisma.staticImportState.findUnique({
          where: { id: "global" },
          select: { snapshotSha256: true, updatedAt: true },
        });
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
