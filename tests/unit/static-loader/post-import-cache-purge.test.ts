import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "@/lib/cloudflare/public-ssr-cache-purge-contract";
import {
  ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE_ENV,
  runPostImportCachePurge,
} from "@/static-loader/post-import-cache-purge";

const ORIGIN = "https://life-ustc.test";
const PURGE_SECRET = "edge-cache-purge-secret-value";

function logger() {
  return { error: vi.fn(), log: vi.fn() };
}

function okResponse() {
  return new Response('{"success":true}', { status: 200 });
}

function configurePurge() {
  process.env.APP_PUBLIC_ORIGIN = ORIGIN;
  process.env.EDGE_CACHE_PURGE_SECRET = PURGE_SECRET;
}

describe("post-import cache purge", () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    for (const name of [
      ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE_ENV,
      "APP_PUBLIC_ORIGIN",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ZONE_ID",
      "EDGE_CACHE_PURGE_SECRET",
    ]) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    process.env = { ...previousEnv };
    vi.restoreAllMocks();
  });

  it("rendering-and-cache.cache-layers-and-invalidation-5", async () => {
    configurePurge();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());

    const report = await runPostImportCachePurge(
      { outcome: "committed" },
      logger(),
    );

    expect(report).toEqual({
      failed: false,
      workerEntrypoint: "purged",
      zone: "purged",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const entrypointCall = fetchMock.mock.calls[0];
    expect(String(entrypointCall?.[0])).toBe(
      `${ORIGIN}${PUBLIC_SSR_CACHE_PURGE_PATH}`,
    );
    const init = entrypointCall?.[1] as RequestInit & {
      headers: Record<string, string>;
    };
    expect(init.method).toBe("POST");
    expect(init.headers[PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]).toBe(
      PURGE_SECRET,
    );
  });

  it.each(["rolled-back"] as const)(
    "purges nothing for a %s import",
    async (outcome) => {
      configurePurge();
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(okResponse());

      const report = await runPostImportCachePurge({ outcome }, logger());

      expect(report).toEqual({
        failed: false,
        workerEntrypoint: "not-run",
        zone: "not-run",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("retries both cache layers for an unchanged committed snapshot", async () => {
    configurePurge();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    expect(
      (await runPostImportCachePurge({ outcome: "committed" }, logger()))
        .failed,
    ).toBe(true);
    fetchMock.mockResolvedValue(okResponse());
    expect(
      await runPostImportCachePurge({ outcome: "unchanged" }, logger()),
    ).toEqual({
      failed: false,
      workerEntrypoint: "purged",
      zone: "purged",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a failure loudly when the entrypoint purge is rejected", async () => {
    configurePurge();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).endsWith(PUBLIC_SSR_CACHE_PURGE_PATH)
        ? new Response('{"error":"Cache purge failed"}', { status: 502 })
        : okResponse(),
    );
    const log = logger();

    const report = await runPostImportCachePurge({ outcome: "committed" }, log);

    expect(report).toEqual({
      failed: true,
      workerEntrypoint: "failed",
      zone: "failed",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Cloudflare zone/CDN and Workers entrypoint"),
      expect.any(Error),
    );
  });

  it("does not log a rejected entrypoint response body", async () => {
    configurePurge();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).endsWith(PUBLIC_SSR_CACHE_PURGE_PATH)
        ? new Response(`private body ${PURGE_SECRET}`, { status: 502 })
        : okResponse(),
    );
    const log = logger();

    const report = await runPostImportCachePurge({ outcome: "committed" }, log);

    expect(report.workerEntrypoint).toBe("failed");
    expect(String(log.error.mock.calls[0]?.[1])).not.toContain(PURGE_SECRET);
    expect(String(log.error.mock.calls[0]?.[1])).toContain("HTTP 502");
  });

  it("rendering-and-cache.cache-layers-and-invalidation-12", async () => {
    process.env.EDGE_CACHE_PURGE_SECRET = PURGE_SECRET;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());
    const log = logger();

    const report = await runPostImportCachePurge({ outcome: "committed" }, log);

    expect(report).toEqual({
      failed: true,
      workerEntrypoint: "failed",
      zone: "failed",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Cloudflare zone/CDN and Workers entrypoint"),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(PURGE_SECRET);
  });

  it("allows skipping purge layers locally when explicitly opted in", async () => {
    process.env.EDGE_CACHE_PURGE_SECRET = PURGE_SECRET;
    process.env[ALLOW_SKIPPING_POST_IMPORT_CACHE_PURGE_ENV] = "true";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());

    const report = await runPostImportCachePurge(
      { outcome: "committed" },
      logger(),
    );

    expect(report).toEqual({
      failed: false,
      workerEntrypoint: "skipped",
      zone: "skipped",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
