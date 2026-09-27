import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  isCoursePageCore,
  isTeacherPageCore,
} from "@/features/catalog/server/catalog-detail-cache-validation";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: async () => "eligibility-revision",
}));

beforeEach(() => resetPublicRuntimeCacheForTest());
afterEach(() => vi.unstubAllGlobals());

function cacheBoundary() {
  const coloValues = new Map<string, Response>();
  const kvValues = new Map<string, string>();
  const scheduled: Promise<unknown>[] = [];
  const colo = {
    match: vi.fn(async (request: Request) =>
      coloValues.get(request.url)?.clone(),
    ),
    put: vi.fn(async (request: Request, response: Response) => {
      coloValues.set(request.url, response.clone());
    }),
  };
  const kv = {
    get: vi.fn(async (key: string) => {
      const stored = kvValues.get(key);
      return stored ? JSON.parse(stored) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      kvValues.set(key, value);
    }),
  };
  vi.stubGlobal("caches", { open: async () => colo });
  return {
    colo,
    kv,
    coloValues,
    kvValues,
    run: <T>(read: () => Promise<T>) =>
      runWithCloudflareRuntimeEnv({ CATALOG_DETAIL_CORE: kv }, read, {
        waitUntil: (promise: Promise<unknown>) => scheduled.push(promise),
      }),
    flush: () => Promise.all(scheduled),
  };
}

const localizedName = {
  nameCn: "Cache fixture",
  nameEn: null,
  namePrimary: "Cache fixture",
  nameSecondary: null,
};
const cores = [
  {
    kind: "course" as const,
    validateResult: isCoursePageCore,
    value: {
      id: 11,
      jwId: 101,
      code: "CACHE101",
      ...localizedName,
      educationLevel: null,
      category: null,
      classType: null,
      type: null,
      sections: [],
      _count: { sections: 0 },
    },
  },
  {
    kind: "teacher" as const,
    validateResult: isTeacherPageCore,
    value: {
      id: 21,
      ...localizedName,
      email: null,
      telephone: null,
      mobile: null,
      address: null,
      department: null,
      teacherTitle: null,
      sections: [],
      _count: { sections: 0 },
    },
  },
];

it("rendering-and-cache.cache-layers-and-invalidation-11", async () => {
  for (const core of cores) {
    for (const rejected of [
      null,
      { ...core.value, viewer: { userId: "private-viewer" } },
    ]) {
      resetPublicRuntimeCacheForTest();
      const cache = cacheBoundary();
      const load = vi.fn<() => Promise<unknown>>().mockResolvedValue(rejected);
      const read = () =>
        cachedPublicDetailRuntimeData({
          id: 101,
          kind: core.kind,
          locale: "zh-cn",
          shape: "eligibility",
          validateResult: core.validateResult,
          load,
        });
      expect(core.validateResult(rejected)).toBe(false);
      expect(await cache.run(read)).toEqual(rejected);
      expect(await cache.run(read)).toEqual(rejected);
      await cache.flush();
      expect(load).toHaveBeenCalledTimes(2);
      expect(cache.colo.put).not.toHaveBeenCalled();
      expect(cache.kv.put).not.toHaveBeenCalled();
      expect(cache.coloValues.size).toBe(0);
      expect(cache.kvValues.size).toBe(0);

      load.mockResolvedValue(core.value);
      expect(await cache.run(read)).toEqual(core.value);
      await cache.flush();
      expect(await cache.run(read)).toEqual(core.value);
      expect(load).toHaveBeenCalledTimes(3);
      expect(cache.colo.put).toHaveBeenCalledOnce();
      expect(cache.kv.put).toHaveBeenCalledOnce();
      resetPublicRuntimeCacheForTest();
      expect(await cache.run(read)).toEqual(core.value);
      expect(load).toHaveBeenCalledTimes(3);
      resetPublicRuntimeCacheForTest();
      cache.coloValues.clear();
      expect(await cache.run(read)).toEqual(core.value);
      await cache.flush();
      expect(load).toHaveBeenCalledTimes(3);
    }
  }
});

it("rendering-and-cache.cache-origin-recovery", async () => {
  for (const core of cores) {
    resetPublicRuntimeCacheForTest();
    const cache = cacheBoundary();
    cache.colo.match.mockRejectedValue(new Error("colo unavailable"));
    cache.kv.get.mockRejectedValue(new Error("KV unavailable"));
    const rejection = new Error("Origin rejected the request");
    const load = vi.fn<() => Promise<unknown>>().mockRejectedValue(rejection);
    const read = () =>
      cachedPublicDetailRuntimeData({
        id: 101,
        kind: core.kind,
        locale: "zh-cn",
        shape: "recovery",
        validateResult: core.validateResult,
        load,
      });
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(cache.run(read)).rejects.toBe(rejection);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.colo.match).toHaveBeenCalledTimes(2);
    expect(cache.kv.get).toHaveBeenCalledTimes(2);
    expect(cache.colo.put).not.toHaveBeenCalled();
    expect(cache.kv.put).not.toHaveBeenCalled();
    load.mockResolvedValue(core.value);
    expect(await cache.run(read)).toEqual(core.value);
    await cache.flush();
    expect(load).toHaveBeenCalledTimes(3);
    expect(await cache.run(read)).toEqual(core.value);
    expect(load).toHaveBeenCalledTimes(3);
  }
});
