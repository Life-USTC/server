import { sha256Base64Url } from "@/lib/crypto/web-crypto";
import {
  cachedCatalogRuntimeData,
  PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS,
} from "@/lib/catalog-runtime-cache";
import { getCanonicalOrigin } from "@/lib/site-url";

export const SITEMAP_RUNTIME_CACHE_TTL_MS = PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS;

type SitemapDocument = {
  body: string;
  etag: string;
};

export function buildSitemapXml(urls: readonly string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}\n</urlset>\n`;
}

async function generateSitemap(
  loadUrls: () => Promise<readonly string[]>,
): Promise<SitemapDocument> {
  const body = buildSitemapXml(await loadUrls());
  return {
    body,
    etag: `"sha256-${await sha256Base64Url(body)}"`,
  };
}

export async function getCachedSitemap(
  loadUrls: () => Promise<readonly string[]>,
) {
  return cachedCatalogRuntimeData(
    "sitemap",
    "sitemap:global",
    getCanonicalOrigin(),
    () => generateSitemap(loadUrls),
  );
}

import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

export function resetSitemapCacheForTest() {
  resetPublicRuntimeCacheForTest();
}
