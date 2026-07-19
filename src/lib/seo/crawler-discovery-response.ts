import { sha256Base64Url } from "@/lib/crypto/web-crypto";
import { CONTENT_SIGNAL } from "@/lib/seo/content-signal";

export const CRAWLER_DISCOVERY_BROWSER_CACHE_CONTROL =
  "public, max-age=0, must-revalidate";
export const CRAWLER_DISCOVERY_CDN_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=21600";

type CrawlerDiscoveryResponseOptions = {
  body: string;
  contentType: string;
  etag?: string;
  request: Request;
};

function requestMatchesEtag(request: Request, etag: string) {
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (!ifNoneMatch) return false;

  return ifNoneMatch.split(",").some((token) => {
    const normalized = token.trim().replace(/^W\//, "");
    return normalized === "*" || normalized === etag;
  });
}

export async function createCrawlerDiscoveryResponse({
  body,
  contentType,
  etag,
  request,
}: CrawlerDiscoveryResponseOptions) {
  const responseEtag = etag ?? `"sha256-${await sha256Base64Url(body)}"`;
  const headers = {
    "Cache-Control": CRAWLER_DISCOVERY_BROWSER_CACHE_CONTROL,
    "Cloudflare-CDN-Cache-Control": CRAWLER_DISCOVERY_CDN_CACHE_CONTROL,
    "Content-Signal": CONTENT_SIGNAL,
    "Content-Type": contentType,
    ETag: responseEtag,
  };

  if (requestMatchesEtag(request, responseEtag)) {
    return new Response(null, { headers, status: 304 });
  }

  return new Response(body, { headers });
}
