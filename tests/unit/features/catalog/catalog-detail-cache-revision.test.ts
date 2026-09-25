import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getCatalogDetailCacheRevision } from "@/lib/catalog-detail-cache-revision";
import {
  buildPublicDetailRuntimeCacheOptions,
  cachedPublicDetailRuntimeData,
} from "@/lib/catalog-detail-runtime-cache";
import {
  buildPublicCatalogRuntimeCacheOptions,
  cachedCatalogRuntimeData,
} from "@/lib/catalog-runtime-cache";
import {
  cachedPublicRuntimeData,
  resetPublicRuntimeCacheForTest,
} from "@/lib/public-runtime-cache";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    staticImportState: {
      findUnique: findUniqueMock,
    },
  },
}));

describe("catalog detail cache revision", () => {
  afterEach(() => {
    resetPublicRuntimeCacheForTest();
    findUniqueMock.mockReset();
  });

  it("scopes the snapshot SHA and materialization time by payload schema", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256:
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    });

    await runWithCloudflareRuntimeEnv({}, async () => {
      const revisions = await Promise.all([
        getCatalogDetailCacheRevision(),
        getCatalogDetailCacheRevision(),
      ]);
      expect(revisions).toEqual([
        "schema1:abcdef0123456789-msv7vmo0",
        "schema1:abcdef0123456789-msv7vmo0",
      ]);
      await expect(getCatalogDetailCacheRevision()).resolves.toBe(revisions[0]);
    });
    expect(findUniqueMock).toHaveBeenCalledOnce();
  });

  it("changes revision when the same snapshot is rematerialized", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256: "abcdef0123456789",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    });
    const first = await getCatalogDetailCacheRevision();

    findUniqueMock.mockResolvedValue({
      snapshotSha256: "abcdef0123456789",
      updatedAt: new Date("2026-08-16T03:01:00.000Z"),
    });

    await expect(getCatalogDetailCacheRevision()).resolves.not.toBe(first);
  });

  it("reads the committed revision immediately after HTML purge in a new request", async () => {
    const state = {
      snapshotSha256: "snapshot-before",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    };
    findUniqueMock.mockImplementation(async () => ({ ...state }));
    const load = vi.fn(async () => ({ title: "before import" }));
    const render = () =>
      runWithCloudflareRuntimeEnv({}, () =>
        cachedCatalogRuntimeData(
          "page:courses-list:zh-cn",
          "page=1",
          "https://life-ustc.test",
          load,
        ),
      );
    expect(await render()).toEqual({ title: "before import" });
    // Both external HTML caches were purged; the old data cache remains.
    state.snapshotSha256 = "snapshot-after";
    load.mockResolvedValue({ title: "after import" });
    expect(await render()).toEqual({ title: "after import" });
    expect(load).toHaveBeenCalledTimes(2);
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("retries a failed revision read within a request", async () => {
    findUniqueMock
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(null);
    await runWithCloudflareRuntimeEnv({}, async () => {
      await expect(getCatalogDetailCacheRevision()).rejects.toThrow(
        "database unavailable",
      );
      await expect(getCatalogDetailCacheRevision()).resolves.toBe(
        "schema1:bootstrap",
      );
    });
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to bootstrap when static import state is missing", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(getCatalogDetailCacheRevision()).resolves.toBe(
      "schema1:bootstrap",
    );
  });

  it.each([
    {
      state: {
        snapshotSha256: "abcdef0123456789",
        updatedAt: new Date("2026-08-16T03:00:00.000Z"),
      },
      oldRevision: "abcdef0123456789-msv7vmo0",
    },
    { state: null, oldRevision: "bootstrap" },
  ])(
    "isolates every list/detail cache layer from old payloads ($oldRevision)",
    async ({ state, oldRevision }) => {
      findUniqueMock.mockResolvedValue(state);
      const namespace = "page:teachers-list:zh-cn";
      const origin = "https://life-ustc.example";
      const detailKey = `v2:${oldRevision}:teacher:zh-cn:1:detail-v1`;
      const listKey = `list:v1:${oldRevision}:${namespace}:page=1`;
      const oldPayload = { id: 1 };
      await cachedPublicRuntimeData(
        "catalog:teacher-detail:zh-cn",
        detailKey,
        60_000,
        async () => oldPayload,
      );
      await cachedPublicRuntimeData(
        namespace,
        listKey,
        60_000,
        async () => oldPayload,
      );

      const detailOptions = await buildPublicDetailRuntimeCacheOptions({
        id: 1,
        kind: "teacher",
        kvShape: "detail-v1",
        locale: "zh-cn",
        origin,
      });
      const listOptions = await buildPublicCatalogRuntimeCacheOptions({
        cacheKey: "page=1",
        namespace,
        origin,
      });
      for (const options of [detailOptions, listOptions]) {
        expect(options.kvCacheKey).toContain(`schema1:${oldRevision}`);
        expect(decodeURIComponent(options.coloCacheKey)).toContain(
          `/schema1:${oldRevision}/`,
        );
      }
      expect(detailOptions.kvCacheKey).not.toBe(detailKey);
      expect(listOptions.kvCacheKey).not.toBe(listKey);

      const freshPayload = { id: 1, sections: [] };
      const loadDetail = vi.fn(async () => freshPayload);
      const loadList = vi.fn(async () => freshPayload);
      await expect(
        cachedPublicDetailRuntimeData({
          id: 1,
          kind: "teacher",
          locale: "zh-cn",
          shape: "detail-v1",
          load: loadDetail,
        }),
      ).resolves.toEqual(freshPayload);
      await expect(
        cachedCatalogRuntimeData(namespace, "page=1", origin, loadList),
      ).resolves.toEqual(freshPayload);
      expect(loadDetail).toHaveBeenCalledOnce();
      expect(loadList).toHaveBeenCalledOnce();
    },
  );

  it("traces only the revision origin read with fixed cache attributes", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256: "abcdef0123456789",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    });
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        name: string,
        callback: (span: { setAttribute: typeof setAttribute }) => T,
      ) => {
        expect(name).toBe("cache.catalog_revision.read");
        return callback({ setAttribute });
      },
    );

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await getCatalogDetailCacheRevision();
        await getCatalogDetailCacheRevision();
      },
      { tracing: { enterSpan } },
    );

    expect(enterSpan).toHaveBeenCalledOnce();
    expect(setAttribute.mock.calls).toEqual([
      ["cache.layer", "origin"],
      ["cache.namespace", "catalog:revision"],
      ["cache.outcome", "success"],
    ]);
  });
});
