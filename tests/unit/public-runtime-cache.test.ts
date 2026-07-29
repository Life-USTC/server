import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  cachedPublicRuntimeData,
  publicDetailColoCacheKey,
} from "@/lib/public-runtime-cache";

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function coloResponse(value: unknown, expiresAt: number, schema?: string) {
  return new Response(
    JSON.stringify({
      expiresAt,
      schema: schema ?? "catalog-detail-core-v1",
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

describe("public runtime cache", () => {
  beforeEach(() => {
    clearPublicRuntimeCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearPublicRuntimeCache();
    vi.useRealTimers();
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
      "/_life-ustc-internal-cache/catalog-detail-core/v1/course/core-without-sections/en-us/683001",
    );
    expect(new URL(teacher).pathname).toContain(
      "/v1/teacher/core-without-sections/en-us/683001",
    );
    expect(new URL(section).pathname).toContain(
      "/v1/section/core-without-exams-schedules-related/zh-cn/683002",
    );
    expect(new Set([course, teacher, section]).size).toBe(3);
  });

  it("returns one in-flight promise for concurrent callers of the same key", async () => {
    const pending = deferred<{ source: string }>();
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
    const expired = deferred<{ source: string } | null>();
    const successor = deferred<{ source: string } | null>();
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
    const expired = deferred<{ source: string }>();
    const successor = deferred<{ source: string }>();

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
    expect(open).toHaveBeenCalledWith("life-ustc-public-detail-core-v1");
    expect(match).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("coalesces one colo miss and schedules one JSON-clean write", async () => {
    const pending = deferred<{ source: string }>();
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
      schema: "catalog-detail-core-v1",
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
});
