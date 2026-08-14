import { describe, expect, it } from "vitest";
import {
  catalogListReadCacheKey,
  catalogListReadCacheNamespace,
} from "@/features/catalog/server/catalog-list-cache";
import {
  catalogListCacheNamespace,
  publicCatalogColoCacheKey,
  publicCatalogKvCacheKey,
} from "@/lib/catalog-runtime-cache";

describe("catalog runtime cache keys", () => {
  it("builds revision-scoped KV and colo keys", () => {
    expect(
      publicCatalogKvCacheKey(
        "rev123",
        "search:catalog:v4:zh-cn",
        "5:数学分析",
      ),
    ).toBe("list:v1:rev123:search:catalog:v4:zh-cn:5:数学分析");
    expect(
      publicCatalogColoCacheKey(
        "https://life.example",
        "search:catalog:v4:zh-cn",
        "5:数学分析",
      ),
    ).toBe(
      "https://life.example/_life-ustc-internal-cache/catalog-runtime/v1/search%3Acatalog%3Av4%3Azh-cn/5%3A%E6%95%B0%E5%AD%A6%E5%88%86%E6%9E%90",
    );
  });

  it("separates shared read and page cache namespaces", () => {
    expect(catalogListReadCacheNamespace("courses", "en-us")).toBe(
      "catalog:courses-list:en-us",
    );
    expect(catalogListCacheNamespace("courses", "en-us", "page")).toBe(
      "page:courses-list:en-us",
    );
  });

  it("canonicalizes shared list filters independently of transport key order", () => {
    expect(
      catalogListReadCacheKey({
        filters: { search: "math", categoryId: "7", ids: [3, 1] },
        pagination: { page: 2, pageSize: 20 },
        shape: "summary",
      }),
    ).toBe(
      JSON.stringify({
        filters: { categoryId: "7", ids: [1, 3], search: "math" },
        pagination: { page: 2, pageSize: 20 },
        shape: "summary",
      }),
    );
  });

  it("includes response shape and serializes dates", () => {
    const filters = { dateFrom: new Date("2026-08-14T00:00:00.000Z") };
    expect(
      catalogListReadCacheKey({
        filters,
        pagination: { page: 1, pageSize: 20 },
        shape: "catalog",
      }),
    ).toContain("2026-08-14T00:00:00.000Z");
  });
});
