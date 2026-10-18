import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  catalogListReadCacheKey,
  catalogListReadCacheNamespace,
} from "@/features/catalog/server/catalog-list-cache";
import {
  buildPublicCatalogRuntimeCacheOptions,
  catalogListCacheNamespace,
} from "@/features/catalog/server/catalog-runtime-cache";

const { revision } = vi.hoisted(() => ({
  revision: vi.fn(async () => "rev123"),
}));
vi.mock("@/features/catalog/server/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: revision,
}));
beforeEach(() => revision.mockResolvedValue("rev123"));

describe("catalog runtime cache keys", () => {
  it("uses a fixed SHA-256 key for all cache layers", async () => {
    const options = await buildPublicCatalogRuntimeCacheOptions({
      origin: "https://life.example",
      namespace: "search:catalog:v5:zh-cn",
      cacheKey: "abc",
    });
    const digest = "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0";
    expect(options.kvCacheKey).toBe(
      `list:v2:rev123:search:catalog:v5:zh-cn:${digest}`,
    );
    expect(options.coloCacheKey).toBe(
      `https://life.example/_life-ustc-internal-cache/catalog-runtime/v2/rev123/search%3Acatalog%3Av5%3Azh-cn/${digest}`,
    );
  });

  it("bounds multibyte keys without truncating distinguishing suffixes", async () => {
    const input = {
      origin: "https://life.example",
      namespace: "catalog:young-events-list" as const,
      cacheKey: new URLSearchParams({
        search: "数学分析".repeat(200),
        page: "1",
      }).toString(),
    };
    const first = await buildPublicCatalogRuntimeCacheOptions(input);
    const changed = await buildPublicCatalogRuntimeCacheOptions({
      ...input,
      cacheKey: `${input.cacheKey}x`,
    });
    expect(new TextEncoder().encode(first.kvCacheKey).length).toBeLessThan(512);
    expect(first.kvCacheKey.length).toBe(changed.kvCacheKey.length);
    expect(first.kvCacheKey).not.toBe(changed.kvCacheKey);
    expect(first.coloCacheKey).not.toBe(changed.coloCacheKey);
    expect(first.kvCacheKey).not.toContain("%E6");
  });

  it("rendering-and-cache.cache-layers-and-invalidation-10", async () => {
    const input = {
      origin: "https://life.example",
      namespace: "catalog:courses-list:zh-cn" as const,
      cacheKey: catalogListReadCacheKey({
        filters: { search: "数学" },
        pagination: { page: 1, pageSize: 20 },
        shape: "summary",
      }),
    };
    const first = await buildPublicCatalogRuntimeCacheOptions(input);
    const reordered = await buildPublicCatalogRuntimeCacheOptions({
      ...input,
      cacheKey: catalogListReadCacheKey({
        shape: "summary",
        pagination: { pageSize: 20, page: 1 },
        filters: { search: "数学" },
      }),
    });
    expect(reordered.kvCacheKey).toBe(first.kvCacheKey);
    const variations = await Promise.all([
      buildPublicCatalogRuntimeCacheOptions({
        ...input,
        namespace: "catalog:courses-list:en-us",
      }),
      buildPublicCatalogRuntimeCacheOptions({
        ...input,
        namespace: "catalog:sections-list:zh-cn",
      }),
      ...[
        {
          filters: { search: "物理" },
          pagination: { page: 1, pageSize: 20 },
          shape: "summary",
        },
        {
          filters: { search: "数学" },
          pagination: { page: 2, pageSize: 20 },
          shape: "summary",
        },
        {
          filters: { search: "数学" },
          pagination: { page: 1, pageSize: 10 },
          shape: "summary",
        },
        {
          filters: { search: "数学" },
          pagination: { page: 1, pageSize: 20 },
          shape: "detail",
        },
      ].map((value) =>
        buildPublicCatalogRuntimeCacheOptions({
          ...input,
          cacheKey: catalogListReadCacheKey(value),
        }),
      ),
    ]);
    revision.mockResolvedValue("rev456");
    variations.push(await buildPublicCatalogRuntimeCacheOptions(input));
    expect(
      new Set([
        first.kvCacheKey,
        ...variations.map((value) => value.kvCacheKey),
      ]).size,
    ).toBe(8);
    const anotherOrigin = await buildPublicCatalogRuntimeCacheOptions({
      ...input,
      origin: "https://other.example",
    });
    expect(anotherOrigin.kvCacheKey).toBe(variations.at(-1)?.kvCacheKey);
    expect(anotherOrigin.coloCacheKey).not.toBe(
      variations.at(-1)?.coloCacheKey,
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

  it("openapi.public-catalog-cache-key", () => {
    const base = {
      filters: { search: "math", categoryId: "7", ids: [3, 1] },
      pagination: { page: 2, pageSize: 20 },
      shape: "summary",
    };
    const key = catalogListReadCacheKey(base);
    for (const changed of [
      { ...base, pagination: { ...base.pagination, page: 3 } },
      { ...base, pagination: { ...base.pagination, pageSize: 10 } },
      { ...base, shape: "catalog" },
      { ...base, filters: { ...base.filters, categoryId: "8" } },
    ])
      expect(catalogListReadCacheKey(changed)).not.toBe(key);
    expect(catalogListReadCacheNamespace("courses", "en-us")).not.toBe(
      catalogListReadCacheNamespace("courses", "zh-cn"),
    );
    expect(catalogListReadCacheNamespace("courses", "zh-cn")).not.toBe(
      catalogListReadCacheNamespace("sections", "zh-cn"),
    );
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
