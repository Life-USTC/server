import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedPublicRuntimeData } from "@/lib/public-runtime-cache";

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

describe("public runtime cache", () => {
  beforeEach(() => {
    clearPublicRuntimeCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearPublicRuntimeCache();
    vi.useRealTimers();
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
});
