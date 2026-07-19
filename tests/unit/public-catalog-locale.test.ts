import { describe, expect, it } from "vitest";
import { resolvePublicCatalogLocale } from "@/lib/api/routes/request-locale";
import {
  PRIVATE_LOCALE_CATALOG_HEADERS,
  PUBLIC_LOCALE_CATALOG_HEADERS,
} from "@/lib/public-cache-control";

function expectHeaders(
  headers: Headers,
  expected: Readonly<Record<string, string>>,
) {
  for (const [name, value] of Object.entries(expected)) {
    expect(headers.get(name)).toBe(value);
  }
}

describe("public catalog locale cache policy", () => {
  it.each([
    "en-us",
    "zh-cn",
  ] as const)("publicly caches explicit %s URL variants", (locale) => {
    const result = resolvePublicCatalogLocale(
      new Request(`https://example.test/api/courses?locale=${locale}&page=1`, {
        headers: {
          "accept-language": locale === "en-us" ? "zh-CN" : "en-US",
          cookie: `NEXT_LOCALE=${locale === "en-us" ? "zh-cn" : "en-us"}`,
        },
      }),
    );

    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) return;

    expect(result.locale).toBe(locale);
    expect(result.cacheHeaders).toBe(PUBLIC_LOCALE_CATALOG_HEADERS);
  });

  it("keeps a cookie-derived locale out of browser and CDN caches", () => {
    const result = resolvePublicCatalogLocale(
      new Request("https://example.test/api/courses?page=1", {
        headers: {
          "accept-language": "en-US",
          cookie: "NEXT_LOCALE=zh-cn",
        },
      }),
    );

    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) return;

    expect(result.locale).toBe("zh-cn");
    expect(result.cacheHeaders).toBe(PRIVATE_LOCALE_CATALOG_HEADERS);
  });

  it("keeps an Accept-Language-derived locale out of shared caches", () => {
    const result = resolvePublicCatalogLocale(
      new Request("https://example.test/api/courses?page=1", {
        headers: { "accept-language": "en-US,en;q=0.9" },
      }),
    );

    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) return;

    expect(result.locale).toBe("en-us");
    expect(result.cacheHeaders).toBe(PRIVATE_LOCALE_CATALOG_HEADERS);
  });

  it("rejects an unsupported explicit locale without caching the error", async () => {
    const result = resolvePublicCatalogLocale(
      new Request("https://example.test/api/courses?locale=fr-fr"),
    );

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) return;

    expect(result.status).toBe(400);
    await expect(result.json()).resolves.toEqual({ error: "Invalid locale" });
    expectHeaders(result.headers, PRIVATE_LOCALE_CATALOG_HEADERS);
  });
});
