import { describe, expect, it } from "vitest";
import { resolvePublicCatalogLocale } from "@/lib/api/routes/request-locale";
import {
  PRIVATE_LOCALE_CATALOG_HEADERS,
  PUBLIC_CATALOG_HEADERS,
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
  it("openapi.public-catalog-locale", () => {
    for (const [query, expected] of [
      ["", "zh-cn"],
      ["locale=zh-cn", "zh-cn"],
      ["locale=en-us", "en-us"],
    ]) {
      for (const locale of ["zh-cn", "en-us"]) {
        const result = resolvePublicCatalogLocale(
          new Request(`https://example.test/api/catalog/courses?${query}`, {
            headers: {
              cookie: `NEXT_LOCALE=${locale}`,
              "accept-language": locale,
            },
          }),
        );
        expect(result).not.toBeInstanceOf(Response);
        if (result instanceof Response)
          throw new Error("Valid locale rejected");
        expect(result.locale).toBe(expected);
        expect(result.cacheHeaders).toBe(PUBLIC_CATALOG_HEADERS);
      }
    }
  });

  it("rejects an unsupported explicit locale without caching the error", async () => {
    const result = resolvePublicCatalogLocale(
      new Request("https://example.test/api/catalog/courses?locale=fr-fr"),
    );

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) return;

    expect(result.status).toBe(400);
    await expect(result.json()).resolves.toEqual({ error: "Invalid locale" });
    expectHeaders(result.headers, PRIVATE_LOCALE_CATALOG_HEADERS);
  });
});
