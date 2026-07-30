import { prisma } from "@/lib/db/prisma";

const REVISION_CACHE_TTL_MS = 60_000;
const BOOTSTRAP_REVISION = "bootstrap";

let cachedRevision: { expiresAt: number; value: string } | null = null;

export function resetCatalogDetailCacheRevisionForTest() {
  cachedRevision = null;
}

export async function getCatalogDetailCacheRevision() {
  const now = Date.now();
  if (cachedRevision && cachedRevision.expiresAt > now) {
    return cachedRevision.value;
  }

  const state = await prisma.staticImportState.findUnique({
    where: { id: "global" },
    select: { snapshotSha256: true },
  });
  const value = state?.snapshotSha256?.slice(0, 16) ?? BOOTSTRAP_REVISION;
  cachedRevision = { expiresAt: now + REVISION_CACHE_TTL_MS, value };
  return value;
}
