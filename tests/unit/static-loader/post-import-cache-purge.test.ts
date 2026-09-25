import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "@/lib/cloudflare/public-ssr-cache-purge-contract";
import { runPostImportCachePurge } from "@/static-loader/post-import-cache-purge";

const ORIGIN = "https://life-ustc.test";
const PURGE_SECRET = "edge-cache-purge-secret-value";

function logger() {
  return { error: vi.fn(), log: vi.fn() };
}

function okResponse() {
  return new Response('{"success":true}', { status: 200 });
}

function configureBothLayers() {
  process.env.CLOUDFLARE_ZONE_ID = "zone-1";
  process.env.CLOUDFLARE_API_TOKEN = "token-1";
  process.env.APP_PUBLIC_ORIGIN = ORIGIN;
  process.env.EDGE_CACHE_PURGE_SECRET = PURGE_SECRET;
}

describe("post-import cache purge", () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    for (const name of [
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

  it("invalidates the Workers entrypoint cache after a committed import", async () => {
    configureBothLayers();
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

    // The zone purge alone never reaches the Workers entrypoint cache, so a
    // committed import has to call both endpoints.
    const targets = fetchMock.mock.calls.map(([input]) => String(input));
    expect(targets).toContain(`${ORIGIN}${PUBLIC_SSR_CACHE_PURGE_PATH}`);
    expect(
      targets.some((target) => target.includes("/zones/zone-1/purge_cache")),
    ).toBe(true);

    const entrypointCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith(PUBLIC_SSR_CACHE_PURGE_PATH),
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
      configureBothLayers();
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

  it("retries both layers when the committed snapshot is reapplied unchanged", async () => {
    configureBothLayers();
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reports a failure loudly when the entrypoint purge is rejected", async () => {
    configureBothLayers();
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
      zone: "purged",
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Workers entrypoint"),
      expect.any(Error),
    );
  });

  it("does not log a rejected entrypoint response body", async () => {
    configureBothLayers();
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

  it("treats a successful HTTP status with a rejected zone purge as failure", async () => {
    configureBothLayers();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/zones/")
        ? new Response(
            JSON.stringify({
              success: false,
              errors: [{ message: PURGE_SECRET }],
            }),
            { status: 200 },
          )
        : okResponse(),
    );
    const log = logger();

    const report = await runPostImportCachePurge({ outcome: "committed" }, log);

    expect(report).toEqual({
      failed: true,
      workerEntrypoint: "purged",
      zone: "failed",
    });
    expect(String(log.error.mock.calls[0]?.[1])).not.toContain(PURGE_SECRET);
  });

  it("never sends the secret to an unconfigured origin", async () => {
    process.env.CLOUDFLARE_ZONE_ID = "zone-1";
    process.env.CLOUDFLARE_API_TOKEN = "token-1";
    process.env.EDGE_CACHE_PURGE_SECRET = PURGE_SECRET;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());

    const report = await runPostImportCachePurge(
      { outcome: "committed" },
      logger(),
    );

    expect(report.workerEntrypoint).toBe("skipped");
    expect(report.failed).toBe(false);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(PURGE_SECRET);
  });
});
