import { describe, expect, it, vi } from "vitest";
import {
  catalogListCacheNamespace,
  publicCatalogColoCacheKey,
  publicCatalogKvCacheKey,
} from "@/lib/catalog-runtime-cache";
import { purgeCloudflareCacheByTags } from "@/lib/cloudflare/edge-cache-purge";

describe("catalog runtime cache keys", () => {
  it("builds revision-scoped KV and colo keys", () => {
    expect(
      publicCatalogKvCacheKey("rev123", "page:sections:zh-cn", "page=1"),
    ).toBe("list:v1:rev123:page:sections:zh-cn:page=1");
    expect(
      publicCatalogColoCacheKey(
        "https://life.example",
        "page:sections:zh-cn",
        "page=1",
      ),
    ).toBe(
      "https://life.example/_life-ustc-internal-cache/catalog-runtime/v1/page%3Asections%3Azh-cn/page%3D1",
    );
  });

  it("namespaces list caches by kind, locale, and scope", () => {
    expect(catalogListCacheNamespace("courses", "en-us", "api")).toBe(
      "api:courses-list:en-us",
    );
  });
});

describe("edge cache purge", () => {
  it("skips purge when credentials are missing", async () => {
    const originalZoneId = process.env.CLOUDFLARE_ZONE_ID;
    const originalToken = process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;

    await expect(purgeCloudflareCacheByTags(["catalog"])).resolves.toEqual({
      ok: false,
      skipped: true,
    });

    process.env.CLOUDFLARE_ZONE_ID = originalZoneId;
    process.env.CLOUDFLARE_API_TOKEN = originalToken;
  });

  it("purges by tag when credentials are configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.CLOUDFLARE_ZONE_ID = "zone-1";
    process.env.CLOUDFLARE_API_TOKEN = "token-1";

    await expect(purgeCloudflareCacheByTags(["catalog"])).resolves.toEqual({
      ok: true,
      skipped: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tags: ["catalog"] }),
      }),
    );

    vi.unstubAllGlobals();
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  });
});
