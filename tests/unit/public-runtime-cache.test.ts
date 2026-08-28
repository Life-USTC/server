import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  publicDetailColoCacheKey as buildPublicDetailColoCacheKey,
  cachedPublicRuntimeData,
  publicDetailKvCacheKey,
} from "@/lib/public-runtime-cache";
import { createDeferred } from "../shared/deferred";

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

function coloResponse(value: unknown, expiresAt: number, schema?: string) {
  return new Response(
    JSON.stringify({
      expiresAt,
      schema: schema ?? "catalog-detail-core-v2",
      value,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function validatesSource(value: unknown) {
  return (
    value !== null &&
    typeof value === "object" &&
    "source" in value &&
    typeof value.source === "string"
  );
}

function publicDetailColoCacheKey(
  origin: string,
  kind: "course" | "section" | "teacher",
  locale: "en-us" | "zh-cn",
  id: number,
) {
  const shape =
    kind === "section"
      ? "core-without-exams-schedules-related"
      : "core-without-sections";
  return buildPublicDetailColoCacheKey(
    origin,
    "revision-a",
    kind,
    locale,
    id,
    shape,
  );
}

function installNamedCache(options?: {
  match?: (request: Request) => Promise<Response | undefined>;
  put?: (request: Request, response: Response) => Promise<void>;
}) {
  const match = vi.fn(options?.match ?? (async () => undefined));
  const put = vi.fn(options?.put ?? (async () => undefined));
  const cache = { match, put };
  const open = vi.fn(async () => cache);
  vi.stubGlobal("caches", { open });
  return { cache, match, open, put };
}

function runtimeExecutionContext() {
  const scheduled: Promise<unknown>[] = [];
  const context = {
    waitUntil(this: unknown, promise: Promise<unknown>) {
      expect(this).toBe(context);
      scheduled.push(promise);
    },
  };
  return { context, scheduled };
}

function kvNamespace() {
  const values = new Map<string, string>();
  return {
    get: vi.fn(
      async (key: string, options?: { cacheTtl?: number; type: "json" }) => {
        void options;
        const value = values.get(key);
        return value ? JSON.parse(value) : null;
      },
    ),
    put: vi.fn(
      async (
        key: string,
        value: string,
        options?: { expirationTtl?: number },
      ) => {
        void options;
        values.set(key, value);
      },
    ),
    seed(key: string, envelope: unknown) {
      values.set(key, JSON.stringify(envelope));
    },
  };
}

function expectCacheEvent(
  writeDataPoint: ReturnType<typeof vi.fn>,
  event: string,
  reason: string,
) {
  expect(
    writeDataPoint.mock.calls.filter(
      ([dataPoint]) =>
        dataPoint.blobs?.[1] === event && dataPoint.blobs?.[3] === reason,
    ),
  ).toHaveLength(1);
  expect(writeDataPoint).toHaveBeenCalledWith({
    indexes: ["cache:page:course-detail:en-us"],
    blobs: [
      "public_runtime_cache_v3",
      event,
      "page:course-detail:en-us",
      reason,
    ],
    doubles: [expect.any(Number), 60_000, expect.any(Number)],
  });
}

function expectColoCacheEvent(
  writeDataPoint: ReturnType<typeof vi.fn>,
  event: string,
  reason: string,
) {
  expectCacheEvent(writeDataPoint, event, reason);
}

type ObservedColoMissOptions = {
  loadResult?: unknown;
  put?: (request: Request, response: Response) => Promise<void>;
  scheduler?: "available" | "missing" | "throws";
  validate?: (value: unknown) => boolean;
  writeDataPoint?: ReturnType<typeof vi.fn>;
};

async function observeColoMiss(options: ObservedColoMissOptions = {}) {
  const writeDataPoint = options.writeDataPoint ?? vi.fn();
  const { put } = installNamedCache(
    options.put ? { put: options.put } : undefined,
  );
  const scheduled: Promise<unknown>[] = [];
  const context =
    options.scheduler === "missing"
      ? undefined
      : {
          waitUntil(promise: Promise<unknown>) {
            if (options.scheduler === "throws") {
              throw new Error("scheduler failed");
            }
            scheduled.push(promise);
          },
        };
  const loadResult = Object.hasOwn(options, "loadResult")
    ? options.loadResult
    : { source: "database" };

  const result = await runWithCloudflareRuntimeEnv(
    { ANALYTICS: { writeDataPoint } },
    async () => {
      const value = await cachedPublicRuntimeData(
        "page:course-detail:en-us",
        "observed-colo-miss",
        60_000,
        async () => loadResult,
        {
          coloCacheKey: publicDetailColoCacheKey(
            "https://example.test",
            "course",
            "en-us",
            683009,
          ),
          validateColoCacheResult: options.validate ?? validatesSource,
        },
      );
      await Promise.all(scheduled);
      return value;
    },
    context,
  );

  return { put, result, scheduled, writeDataPoint };
}

describe("public runtime cache", () => {
  beforeEach(() => {
    clearPublicRuntimeCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearPublicRuntimeCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds same-origin versioned detail keys isolated by kind, shape, locale, and ID", () => {
    const course = publicDetailColoCacheKey(
      "https://example.test",
      "course",
      "en-us",
      683001,
    );
    const teacher = publicDetailColoCacheKey(
      "https://example.test",
      "teacher",
      "en-us",
      683001,
    );
    const section = publicDetailColoCacheKey(
      "https://example.test",
      "section",
      "zh-cn",
      683002,
    );

    expect(new URL(course).origin).toBe("https://example.test");
    expect(new URL(course).pathname).toBe(
      "/_life-ustc-internal-cache/catalog-detail-core/v2/revision-a/course/core-without-sections/en-us/683001",
    );
    expect(new URL(teacher).pathname).toContain(
      "/v2/revision-a/teacher/core-without-sections/en-us/683001",
    );
    expect(new URL(section).pathname).toContain(
      "/v2/revision-a/section/core-without-exams-schedules-related/zh-cn/683002",
    );
    expect(new Set([course, teacher, section]).size).toBe(3);
  });

  it("builds versioned KV keys isolated by revision, kind, shape, locale, and ID", () => {
    expect(
      publicDetailKvCacheKey(
        "abc123def4567890",
        "section",
        "zh-cn",
        12345,
        "core-without-exams-schedules-related",
      ),
    ).toBe(
      "v2:abc123def4567890:section:zh-cn:12345:core-without-exams-schedules-related",
    );
    expect(
      publicDetailKvCacheKey(
        "abc123def4567890",
        "course",
        "en-us",
        683001,
        "core-without-sections",
      ),
    ).toBe("v2:abc123def4567890:course:en-us:683001:core-without-sections");
  });

  it("falls through a colo miss to a KV hit and then serves it from L1", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const cached = { source: "kv" };
    const namespace = kvNamespace();
    const kvCacheKey = publicDetailKvCacheKey(
      "rev",
      "course",
      "en-us",
      683001,
      "core-without-sections",
    );
    namespace.seed(kvCacheKey, {
      expiresAt: 20_000,
      schema: "catalog-detail-core-v2",
      value: cached,
    });
    const { match, open, put } = installNamedCache();
    const load = vi.fn(async () => ({ source: "database" }));
    const { context, scheduled } = runtimeExecutionContext();

    await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: namespace },
      async () => {
        const first = await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          "course:683001",
          60_000,
          load,
          {
            coloCacheKey: publicDetailColoCacheKey(
              "https://example.test",
              "course",
              "en-us",
              683001,
            ),
            kvCacheKey,
            validateColoCacheResult: validatesSource,
          },
        );
        const second = await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          "course:683001",
          60_000,
          load,
          {
            coloCacheKey: publicDetailColoCacheKey(
              "https://example.test",
              "course",
              "en-us",
              683001,
            ),
            kvCacheKey,
            validateColoCacheResult: validatesSource,
          },
        );

        expect(first).toEqual(cached);
        expect(second).toBe(first);
        await Promise.all(scheduled);
      },
      context,
    );

    expect(namespace.get).toHaveBeenCalledOnce();
    expect(namespace.get).toHaveBeenCalledWith(kvCacheKey, {
      cacheTtl: 60,
      type: "json",
    });
    expect(open).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledOnce();
  });

  it("falls through colo and KV misses and schedules KV and colo writes", async () => {
    const pending = createDeferred<{ source: string }>();
    const namespace = kvNamespace();
    const { match, put } = installNamedCache();
    const load = vi.fn(() => pending.promise);
    const { context, scheduled } = runtimeExecutionContext();
    const coloCacheKey = publicDetailColoCacheKey(
      "https://example.test",
      "section",
      "en-us",
      683002,
    );
    const kvCacheKey = publicDetailKvCacheKey(
      "rev",
      "section",
      "en-us",
      683002,
      "core-without-exams-schedules-related",
    );

    await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: namespace },
      async () => {
        const options = {
          coloCacheKey,
          kvCacheKey,
          shouldCacheResult: (result: { source: string }) => result !== null,
          validateColoCacheResult: validatesSource,
        };
        const first = cachedPublicRuntimeData(
          "page:section-detail:en-us",
          "section:683002",
          60_000,
          load,
          options,
        );
        await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
        pending.resolve({ source: "database" });
        await expect(first).resolves.toEqual({ source: "database" });
        expect(scheduled).toHaveLength(2);
        await Promise.all(scheduled);
      },
      context,
    );

    expect(namespace.get).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
    expect(namespace.put).toHaveBeenCalledOnce();
    const [kvKey, kvValue, kvOptions] = namespace.put.mock.calls[0] ?? [];
    expect(kvKey).toBe(kvCacheKey);
    expect(kvOptions).toEqual({ expirationTtl: 60 });
    await expect(JSON.parse(kvValue as string)).toMatchObject({
      expiresAt: expect.any(Number),
      schema: "catalog-detail-core-v2",
      value: { source: "database" },
    });
  });

  it("reports KV read errors without failing the request path", async () => {
    const namespace = {
      get: vi.fn(async () => {
        throw new Error("kv read failed");
      }),
      put: vi.fn(async () => undefined),
    };
    const { put } = installNamedCache();
    const load = vi.fn(async () => ({ source: "database" }));
    const writeDataPoint = vi.fn();
    const { context, scheduled } = runtimeExecutionContext();

    await runWithCloudflareRuntimeEnv(
      { ANALYTICS: { writeDataPoint }, CATALOG_DETAIL_CORE: namespace },
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "page:course-detail:en-us",
            "kv-read-error",
            60_000,
            load,
            {
              coloCacheKey: publicDetailColoCacheKey(
                "https://example.test",
                "course",
                "en-us",
                683007,
              ),
              validateColoCacheResult: validatesSource,
            },
          ),
        ).resolves.toEqual({ source: "database" });
        await Promise.all(scheduled);
      },
      context,
    );

    expect(load).toHaveBeenCalledOnce();
    expectCacheEvent(writeDataPoint, "kv_read_error", "none");
    expect(put).toHaveBeenCalledOnce();
    expect(namespace.put).toHaveBeenCalledOnce();
  });

  it("records phase-local cache durations and fixed low-cardinality spans", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    let monotonic = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    const writeDataPoint = vi.fn();
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        name: string,
        callback: (span: { setAttribute: typeof setAttribute }) => T,
      ) => {
        void name;
        return callback({ setAttribute });
      },
    );
    const namespace = {
      get: vi.fn(async () => {
        vi.setSystemTime(Date.now() + 111);
        monotonic += 11;
        return null;
      }),
      put: vi.fn(async () => undefined),
    };
    const { match } = installNamedCache({
      match: async () => {
        vi.setSystemTime(Date.now() + 223);
        monotonic += 23;
        return undefined;
      },
    });
    const scheduled: Promise<unknown>[] = [];
    const context = {
      tracing: { enterSpan },
      waitUntil(promise: Promise<unknown>) {
        scheduled.push(promise);
      },
    };
    const sensitiveKey = "search=sensitive-marker-683011";

    await runWithCloudflareRuntimeEnv(
      { ANALYTICS: { writeDataPoint }, CATALOG_DETAIL_CORE: namespace },
      async () => {
        await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          sensitiveKey,
          60_000,
          async () => {
            vi.setSystemTime(Date.now() + 337);
            monotonic += 37;
            return { source: "database" };
          },
          {
            coloCacheKey: publicDetailColoCacheKey(
              "https://example.test",
              "course",
              "en-us",
              683011,
            ),
            kvCacheKey: publicDetailKvCacheKey(
              "rev",
              "course",
              "en-us",
              683011,
              "core-without-sections",
            ),
            validateColoCacheResult: validatesSource,
          },
        );
        await Promise.all(scheduled);
      },
      context,
    );

    const durationFor = (event: string) =>
      writeDataPoint.mock.calls.find(
        ([dataPoint]) => dataPoint.blobs?.[1] === event,
      )?.[0].doubles?.[0];
    expect(durationFor("colo_miss")).toBe(23);
    expect(durationFor("kv_miss")).toBe(11);
    expect(durationFor("load_success")).toBe(37);
    expect(match).toHaveBeenCalledOnce();
    expect(enterSpan.mock.calls.map(([name]) => name)).toEqual([
      "cache.colo.read",
      "cache.kv.read",
      "cache.origin_load",
    ]);
    expect(setAttribute.mock.calls).toEqual([
      ["cache.layer", "colo"],
      ["cache.namespace", "page:course-detail:en-us"],
      ["cache.outcome", "miss"],
      ["cache.layer", "kv"],
      ["cache.namespace", "page:course-detail:en-us"],
      ["cache.outcome", "miss"],
      ["cache.layer", "origin"],
      ["cache.namespace", "page:course-detail:en-us"],
      ["cache.outcome", "success"],
    ]);
    expect(JSON.stringify(setAttribute.mock.calls)).not.toContain(sensitiveKey);
  });

  it("records one phase-local origin error without retaining the failed load", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    let monotonic = 2_000;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    const writeDataPoint = vi.fn();
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        _name: string,
        callback: (span: { setAttribute: typeof setAttribute }) => T,
      ) => callback({ setAttribute }),
    );
    const load = vi.fn(async () => {
      vi.setSystemTime(Date.now() + 410);
      monotonic += 41;
      throw new Error("origin failed");
    });

    await runWithCloudflareRuntimeEnv(
      { ANALYTICS: { writeDataPoint } },
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "api:metadata",
            "private-cache-key",
            60_000,
            load,
          ),
        ).rejects.toThrow("origin failed");
      },
      { tracing: { enterSpan } },
    );

    const loadErrors = writeDataPoint.mock.calls.filter(
      ([dataPoint]) => dataPoint.blobs?.[1] === "load_error",
    );
    expect(loadErrors).toHaveLength(1);
    expect(loadErrors[0]?.[0].doubles?.[0]).toBe(41);
    expect(setAttribute).toHaveBeenCalledWith("cache.outcome", "error");
    await expect(
      cachedPublicRuntimeData(
        "api:metadata",
        "private-cache-key",
        60_000,
        async () => ({ source: "retry" }),
      ),
    ).resolves.toEqual({ source: "retry" });
    expect(load).toHaveBeenCalledOnce();
  });

  it("uses wall-clock time for TTL while measuring cache work monotonically", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const monotonic = 3_000;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    const writeDataPoint = vi.fn();
    const load = vi.fn(async () => {
      vi.setSystemTime(Date.now() + 250);
      return { source: "database" };
    });

    await runWithCloudflareRuntimeEnv(
      { ANALYTICS: { writeDataPoint } },
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "api:metadata",
            "wall-clock-ttl",
            1_000,
            load,
          ),
        ).resolves.toEqual({ source: "database" });

        await expect(
          cachedPublicRuntimeData(
            "api:metadata",
            "wall-clock-ttl",
            1_000,
            load,
          ),
        ).resolves.toEqual({ source: "database" });

        vi.setSystemTime(11_001);
        await expect(
          cachedPublicRuntimeData(
            "api:metadata",
            "wall-clock-ttl",
            1_000,
            load,
          ),
        ).resolves.toEqual({ source: "database" });
      },
    );

    expect(load).toHaveBeenCalledTimes(2);
    const events = writeDataPoint.mock.calls.map(
      ([dataPoint]) => dataPoint.blobs?.[1],
    );
    expect(events).toEqual([
      "miss",
      "load_success",
      "hit",
      "miss",
      "load_success",
    ]);
    expect(
      writeDataPoint.mock.calls
        .filter(([dataPoint]) => dataPoint.blobs?.[1] === "load_success")
        .map(([dataPoint]) => dataPoint.doubles?.[0]),
    ).toEqual([0, 0]);
  });

  it("returns one in-flight promise for concurrent callers of the same key", async () => {
    const pending = createDeferred<{ source: string }>();
    const load = vi.fn(() => pending.promise);

    const first = cachedPublicRuntimeData(
      "api:metadata",
      "same-key",
      60_000,
      load,
    );
    const second = cachedPublicRuntimeData(
      "api:metadata",
      "same-key",
      60_000,
      load,
    );

    expect(first).toBe(second);
    await Promise.resolve();
    expect(load).toHaveBeenCalledOnce();
    pending.resolve({ source: "shared" });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { source: "shared" },
      { source: "shared" },
    ]);
  });

  it("isolates identical L1 keys across namespaces", async () => {
    const chineseLoad = vi.fn(async () => ({ locale: "zh-cn" }));
    const englishLoad = vi.fn(async () => ({ locale: "en-us" }));

    await expect(
      cachedPublicRuntimeData(
        "search:catalog:v4:zh-cn",
        "5:calculus",
        60_000,
        chineseLoad,
      ),
    ).resolves.toEqual({ locale: "zh-cn" });
    await expect(
      cachedPublicRuntimeData(
        "search:catalog:v4:en-us",
        "5:calculus",
        60_000,
        englishLoad,
      ),
    ).resolves.toEqual({ locale: "en-us" });

    expect(chineseLoad).toHaveBeenCalledOnce();
    expect(englishLoad).toHaveBeenCalledOnce();
  });

  it("does not retain null results", async () => {
    const load = vi.fn(async () => null);
    const options = { shouldCacheResult: (result: null) => result !== null };

    await cachedPublicRuntimeData(
      "api:metadata",
      "nullable",
      60_000,
      load,
      options,
    );
    await cachedPublicRuntimeData(
      "api:metadata",
      "nullable",
      60_000,
      load,
      options,
    );

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("propagates cache predicate errors and removes the entry", async () => {
    const load = vi.fn(async () => ({ source: "database" }));
    const options = {
      shouldCacheResult: () => {
        throw new Error("predicate failed");
      },
    };

    await expect(
      cachedPublicRuntimeData(
        "api:metadata",
        "predicate-error",
        60_000,
        load,
        options,
      ),
    ).rejects.toThrow("predicate failed");
    await expect(
      cachedPublicRuntimeData(
        "api:metadata",
        "predicate-error",
        60_000,
        load,
        options,
      ),
    ).rejects.toThrow("predicate failed");

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not let an expired null load delete its successor", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const expired = createDeferred<{ source: string } | null>();
    const successor = createDeferred<{ source: string } | null>();
    const options = {
      shouldCacheResult: (result: { source: string } | null) => result !== null,
    };

    const first = cachedPublicRuntimeData(
      "api:metadata",
      "null-race",
      60_000,
      () => expired.promise,
      options,
    );
    await Promise.resolve();
    vi.setSystemTime(60_001);
    const second = cachedPublicRuntimeData(
      "api:metadata",
      "null-race",
      60_000,
      () => successor.promise,
      options,
    );
    await Promise.resolve();

    expired.resolve(null);
    await expect(first).resolves.toBeNull();
    successor.resolve({ source: "successor" });
    await expect(second).resolves.toEqual({ source: "successor" });
    await expect(
      cachedPublicRuntimeData(
        "api:metadata",
        "null-race",
        60_000,
        vi.fn(async () => ({ source: "unexpected" })),
        options,
      ),
    ).resolves.toEqual({ source: "successor" });
  });

  it("does not let an expired failed load delete its successor", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const expired = createDeferred<{ source: string }>();
    const successor = createDeferred<{ source: string }>();

    const first = cachedPublicRuntimeData(
      "api:metadata",
      "error-race",
      60_000,
      () => expired.promise,
    );
    const firstResult = expect(first).rejects.toThrow("expired failure");
    await Promise.resolve();
    vi.setSystemTime(60_001);
    const second = cachedPublicRuntimeData(
      "api:metadata",
      "error-race",
      60_000,
      () => successor.promise,
    );
    await Promise.resolve();

    expired.reject(new Error("expired failure"));
    await firstResult;
    successor.resolve({ source: "successor" });
    await expect(second).resolves.toEqual({ source: "successor" });
    await expect(
      cachedPublicRuntimeData(
        "api:metadata",
        "error-race",
        60_000,
        vi.fn(async () => ({ source: "unexpected" })),
      ),
    ).resolves.toEqual({ source: "successor" });
  });

  it("uses a named colo hit without loading and then serves it from L1", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const cached = { source: "colo" };
    const { match, open, put } = installNamedCache({
      match: async () => coloResponse(cached, 20_000),
    });
    const load = vi.fn(async () => ({ source: "database" }));
    const { context } = runtimeExecutionContext();

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        const first = await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          "course:683001",
          60_000,
          load,
          {
            coloCacheKey: publicDetailColoCacheKey(
              "https://example.test",
              "course",
              "en-us",
              683001,
            ),
            shouldCacheResult: (result) => result !== null,
            validateColoCacheResult: validatesSource,
          },
        );
        const second = await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          "course:683001",
          60_000,
          load,
          {
            coloCacheKey: publicDetailColoCacheKey(
              "https://example.test",
              "course",
              "en-us",
              683001,
            ),
            validateColoCacheResult: validatesSource,
          },
        );

        expect(first).toEqual(cached);
        expect(second).toBe(first);
      },
      context,
    );

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith("life-ustc-public-detail-core-v2");
    expect(match).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("coalesces one colo miss and schedules one JSON-clean write", async () => {
    const pending = createDeferred<{ source: string }>();
    const { match, put } = installNamedCache();
    const load = vi.fn(() => pending.promise);
    const { context, scheduled } = runtimeExecutionContext();
    const coloCacheKey = publicDetailColoCacheKey(
      "https://example.test",
      "section",
      "en-us",
      683002,
    );

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        const options = {
          coloCacheKey,
          shouldCacheResult: (result: { source: string }) => result !== null,
          validateColoCacheResult: validatesSource,
        };
        const first = cachedPublicRuntimeData(
          "page:section-detail:en-us",
          "section:683002",
          60_000,
          load,
          options,
        );
        const second = cachedPublicRuntimeData(
          "page:section-detail:en-us",
          "section:683002",
          60_000,
          load,
          options,
        );

        expect(first).toBe(second);
        await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
        pending.resolve({ source: "database" });
        await expect(Promise.all([first, second])).resolves.toEqual([
          { source: "database" },
          { source: "database" },
        ]);
        expect(scheduled).toHaveLength(1);
        await scheduled[0];
      },
      context,
    );

    expect(match).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
    const [writtenRequest, writtenResponse] = put.mock.calls[0] ?? [];
    expect(writtenRequest?.url).toBe(coloCacheKey);
    expect(writtenResponse?.headers.get("cache-control")).toBe(
      "public, max-age=60",
    );
    await expect(writtenResponse?.clone().json()).resolves.toMatchObject({
      expiresAt: expect.any(Number),
      schema: "catalog-detail-core-v2",
      value: { source: "database" },
    });
  });

  it("does not extend an absolute colo expiry when refilling L1", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { match } = installNamedCache({
      match: vi
        .fn()
        .mockResolvedValueOnce(coloResponse({ source: "colo" }, 1_000))
        .mockResolvedValueOnce(undefined),
    });
    const load = vi.fn(async () => ({ source: "database" }));
    const { context } = runtimeExecutionContext();
    const options = {
      coloCacheKey: publicDetailColoCacheKey(
        "https://example.test",
        "teacher",
        "en-us",
        683003,
      ),
      validateColoCacheResult: validatesSource,
    };

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "page:teacher-detail:en-us",
            "teacher:683003",
            60_000,
            load,
            options,
          ),
        ).resolves.toEqual({ source: "colo" });
        vi.setSystemTime(1_001);
        await expect(
          cachedPublicRuntimeData(
            "page:teacher-detail:en-us",
            "teacher:683003",
            60_000,
            load,
            options,
          ),
        ).resolves.toEqual({ source: "database" });
      },
      context,
    );

    expect(match).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledOnce();
  });

  it.each([
    ["malformed JSON", () => new Response("not-json")],
    [
      "wrong schema",
      () => coloResponse({ source: "wrong-schema" }, 30_000, "other-v1"),
    ],
    ["expired envelope", () => coloResponse({ source: "expired" }, 1)],
    ["null value", () => coloResponse(null, 30_000)],
    ["wrong payload", () => coloResponse({ unexpected: true }, 30_000)],
  ])("never serves a %s colo entry", async (_case, response) => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { put } = installNamedCache({ match: async () => response() });
    const load = vi.fn(async () => ({ source: "database" }));
    const { context, scheduled } = runtimeExecutionContext();

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "page:course-detail:en-us",
            `invalid:${_case}`,
            60_000,
            load,
            {
              coloCacheKey: publicDetailColoCacheKey(
                "https://example.test",
                "course",
                "en-us",
                683004,
              ),
              shouldCacheResult: (result) => result !== null,
              validateColoCacheResult: validatesSource,
            },
          ),
        ).resolves.toEqual({ source: "database" });
        await Promise.all(scheduled);
      },
      context,
    );

    expect(load).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
  });

  it("never writes nulls or loader failures to the colo cache", async () => {
    const { put } = installNamedCache();
    const { context, scheduled } = runtimeExecutionContext();
    const options = {
      coloCacheKey: publicDetailColoCacheKey(
        "https://example.test",
        "section",
        "zh-cn",
        683005,
      ),
      shouldCacheResult: (result: { source: string } | null) => result !== null,
      validateColoCacheResult: validatesSource,
    };

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "page:section-detail:zh-cn",
            "null-colo",
            60_000,
            async () => null,
            options,
          ),
        ).resolves.toBeNull();
        await expect(
          cachedPublicRuntimeData(
            "page:section-detail:zh-cn",
            "error-colo",
            60_000,
            async () => {
              throw new Error("load failed");
            },
            options,
          ),
        ).rejects.toThrow("load failed");
      },
      context,
    );

    expect(put).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });

  it("fails open when colo reads and writes reject", async () => {
    const { put } = installNamedCache({
      match: async () => {
        throw new Error("read failed");
      },
      put: async () => {
        throw new Error("write failed");
      },
    });
    const load = vi.fn(async () => ({ source: "database" }));
    const { context, scheduled } = runtimeExecutionContext();

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await expect(
          cachedPublicRuntimeData(
            "page:course-detail:en-us",
            "fail-open",
            60_000,
            load,
            {
              coloCacheKey: publicDetailColoCacheKey(
                "https://example.test",
                "course",
                "en-us",
                683006,
              ),
              validateColoCacheResult: validatesSource,
            },
          ),
        ).resolves.toEqual({ source: "database" });
        await Promise.all(scheduled);
      },
      context,
    );

    expect(load).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
    expect(scheduled).toHaveLength(1);
  });

  it("reports a validator-rejected canonical result as a write skip", async () => {
    const canonical = { jwId: 683010, source: "database" };
    const { put, result, scheduled, writeDataPoint } = await observeColoMiss({
      loadResult: canonical,
      validate: () => false,
    });

    expect(result).toBe(canonical);
    expect(put).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
    expectColoCacheEvent(writeDataPoint, "colo_write_skip", "result_invalid");
    expect(writeDataPoint).not.toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["colo_write_error"]),
      }),
    );
  });

  it("reports response serialization failures and returns the loaded result", async () => {
    const circular: { self?: unknown; source: string } = {
      source: "database",
    };
    circular.self = circular;
    const { put, result, scheduled, writeDataPoint } = await observeColoMiss({
      loadResult: circular,
      validate: () => true,
    });

    expect(result).toBe(circular);
    expect(put).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
    expectColoCacheEvent(
      writeDataPoint,
      "colo_write_error",
      "response_build_failed",
    );
  });

  it.each([
    {
      expectedPutCalls: 0,
      expectedScheduled: 0,
      name: "an unavailable runtime scheduler",
      options: { scheduler: "missing" as const },
      reason: "scheduler_unavailable",
    },
    {
      expectedPutCalls: 1,
      expectedScheduled: 0,
      name: "a task scheduling failure",
      options: { scheduler: "throws" as const },
      reason: "task_scheduling_failed",
    },
    {
      expectedPutCalls: 1,
      expectedScheduled: 1,
      name: "an asynchronous Cache API rejection",
      options: {
        put: async () => {
          throw new Error("write failed");
        },
      },
      reason: "cache_put_rejected",
    },
    {
      expectedPutCalls: 1,
      expectedScheduled: 0,
      name: "a synchronous Cache API rejection",
      options: {
        put: () => {
          throw new Error("write failed");
        },
      },
      reason: "cache_put_rejected",
    },
  ])(
    "reports $name without failing the loaded result",
    async ({ expectedPutCalls, expectedScheduled, options, reason }) => {
      const { put, result, scheduled, writeDataPoint } =
        await observeColoMiss(options);

      expect(result).toEqual({ source: "database" });
      expect(put).toHaveBeenCalledTimes(expectedPutCalls);
      expect(scheduled).toHaveLength(expectedScheduled);
      expectColoCacheEvent(writeDataPoint, "colo_write_error", reason);
    },
  );

  it("keeps a validator-rejected result available when Analytics Engine fails", async () => {
    const writeDataPoint = vi.fn(() => {
      throw new Error("analytics unavailable");
    });
    const { put, result } = await observeColoMiss({
      loadResult: { source: "canonical" },
      validate: () => false,
      writeDataPoint,
    });

    expect(result).toEqual({ source: "canonical" });
    expect(writeDataPoint).toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
