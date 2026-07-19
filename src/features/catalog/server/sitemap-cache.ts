import { sha256Base64Url } from "@/lib/crypto/web-crypto";

export const SITEMAP_RUNTIME_CACHE_TTL_MS = 60 * 60 * 1_000;

type SitemapDocument = {
  body: string;
  etag: string;
};

type SitemapCacheEntry = {
  document: SitemapDocument;
  expiresAtMs: number;
};

let cachedSitemap: SitemapCacheEntry | undefined;
let sitemapGeneration: Promise<SitemapDocument> | undefined;

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
  const nowMs = Date.now();
  if (cachedSitemap && cachedSitemap.expiresAtMs > nowMs) {
    return cachedSitemap.document;
  }
  cachedSitemap = undefined;

  if (!sitemapGeneration) {
    sitemapGeneration = generateSitemap(loadUrls);
  }

  const generation = sitemapGeneration;
  try {
    const document = await generation;
    cachedSitemap = {
      document,
      expiresAtMs: Date.now() + SITEMAP_RUNTIME_CACHE_TTL_MS,
    };
    return document;
  } finally {
    if (sitemapGeneration === generation) {
      sitemapGeneration = undefined;
    }
  }
}

export function resetSitemapCacheForTest() {
  cachedSitemap = undefined;
  sitemapGeneration = undefined;
}
