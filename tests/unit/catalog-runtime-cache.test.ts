import { describe, expect, it } from "vitest";
import {
  catalogListCacheNamespace,
  publicCatalogColoCacheKey,
  publicCatalogKvCacheKey,
} from "@/lib/catalog-runtime-cache";

describe("catalog runtime cache keys", () => {
  it("builds revision-scoped KV and colo keys", () => {
    expect(
      publicCatalogKvCacheKey("rev123", "search:catalog:zh-cn", "5:数学分析"),
    ).toBe("list:v1:rev123:search:catalog:zh-cn:5:数学分析");
    expect(
      publicCatalogColoCacheKey(
        "https://life.example",
        "search:catalog:zh-cn",
        "5:数学分析",
      ),
    ).toBe(
      "https://life.example/_life-ustc-internal-cache/catalog-runtime/v1/search%3Acatalog%3Azh-cn/5%3A%E6%95%B0%E5%AD%A6%E5%88%86%E6%9E%90",
    );
  });

  it("namespaces list caches by kind, locale, and scope", () => {
    expect(catalogListCacheNamespace("courses", "en-us", "api")).toBe(
      "api:courses-list:en-us",
    );
  });
});
