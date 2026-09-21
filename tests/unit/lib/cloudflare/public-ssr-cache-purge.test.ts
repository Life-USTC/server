import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: logAppEventMock }));

import {
  handlePublicSsrCachePurgeRequest,
  isPublicSsrCachePurgeRequest,
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
  PUBLIC_SSR_CACHE_PURGE_TAGS,
  purgeEntrypointCatalogCache,
} from "@/lib/cloudflare/public-ssr-cache-purge";

const SECRET = "edge-cache-purge-secret-value";

function purgeRequest(
  headers: HeadersInit = { [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: SECRET },
  method = "POST",
) {
  return new Request(`https://life-ustc.test${PUBLIC_SSR_CACHE_PURGE_PATH}`, {
    headers,
    method,
  });
}

describe("public SSR cache purge endpoint", () => {
  beforeEach(() => {
    logAppEventMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the internal purge path out of the public surface", () => {
    expect(PUBLIC_SSR_CACHE_PURGE_PATH.startsWith("/_internal/")).toBe(true);
    expect(isPublicSsrCachePurgeRequest(purgeRequest())).toBe(true);
    expect(
      isPublicSsrCachePurgeRequest(
        new Request("https://life-ustc.test/catalog/courses/1"),
      ),
    ).toBe(false);
  });

  it("purges only the fixed catalog tag, never everything", async () => {
    const purge = vi.fn().mockResolvedValue({ success: true });

    await expect(purgeEntrypointCatalogCache({ purge })).resolves.toEqual({
      ok: true,
      tags: ["catalog"],
    });
    expect(purge).toHaveBeenCalledWith({ tags: ["catalog"] });
    expect(purge.mock.calls[0]?.[0]).not.toHaveProperty("purgeEverything");
    expect([...PUBLIC_SSR_CACHE_PURGE_TAGS]).toEqual(["catalog"]);
  });

  it("reports a missing entrypoint cache instead of a silent no-op", async () => {
    await expect(purgeEntrypointCatalogCache(undefined)).resolves.toEqual({
      ok: false,
      reason: "cache-unavailable",
    });
  });

  it("reports a rejected purge with the platform error summary", async () => {
    await expect(
      purgeEntrypointCatalogCache({
        purge: vi.fn().mockResolvedValue({
          errors: [{ code: 1012, message: "tag purge unavailable" }],
          success: false,
        }),
      }),
    ).resolves.toEqual({
      detail: "1012: tag purge unavailable",
      ok: false,
      reason: "purge-rejected",
    });
  });

  it("rejects a request without the shared secret and never purges", async () => {
    const purge = vi.fn();

    const response = await handlePublicSsrCachePurgeRequest({
      purge,
      request: purgeRequest({}),
      secret: SECRET,
    });

    expect(response.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret and never echoes either value", async () => {
    const purge = vi.fn();

    const response = await handlePublicSsrCachePurgeRequest({
      purge,
      request: purgeRequest({
        [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: "wrong-secret-value",
      }),
      secret: SECRET,
    });

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(SECRET);
    expect(body).not.toContain("wrong-secret-value");
    expect(purge).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    const purge = vi.fn();

    const response = await handlePublicSsrCachePurgeRequest({
      purge,
      request: purgeRequest(),
      secret: undefined,
    });

    expect(response.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
  });

  it("rejects a non-POST request from an authenticated caller", async () => {
    const purge = vi.fn();

    const response = await handlePublicSsrCachePurgeRequest({
      purge,
      request: purgeRequest(
        { [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: SECRET },
        "GET",
      ),
      secret: SECRET,
    });

    expect(response.status).toBe(405);
    expect(purge).not.toHaveBeenCalled();
  });

  it("purges and never stores the purge response itself", async () => {
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi.fn().mockResolvedValue({ ok: true, tags: ["catalog"] }),
      request: purgeRequest(),
      secret: SECRET,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ purged: ["catalog"] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.cache.purge.finish",
      expect.objectContaining({ outcome: "success", tags: "catalog" }),
    );
  });

  it("surfaces a failed purge loudly instead of answering 2xx", async () => {
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi.fn().mockResolvedValue({ ok: false, reason: "purge-rejected" }),
      request: purgeRequest(),
      secret: SECRET,
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Cache purge failed",
      reason: "purge-rejected",
    });
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "edge.cache.purge.error",
      expect.objectContaining({ outcome: "error", reason: "purge-rejected" }),
    );
  });

  it("answers 503 when the entrypoint cache binding is missing", async () => {
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "cache-unavailable" }),
      request: purgeRequest(),
      secret: SECRET,
    });

    expect(response.status).toBe(503);
  });

  it("answers 502 and logs when the RPC hop itself throws", async () => {
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi.fn().mockRejectedValue(new Error("rpc failed")),
      request: purgeRequest(),
      secret: SECRET,
    });

    expect(response.status).toBe(502);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "edge.cache.purge.error",
      expect.objectContaining({
        detail: "Error: rpc failed",
        reason: "purge-threw",
      }),
      expect.any(Error),
    );
  });

  it("names the thrown fault in the body instead of only that it failed", async () => {
    // The production incident: `ctx.exports.PublicSsr()` called without its
    // Options argument threw before the RPC was dispatched. The old body was a
    // bare `{ error: "Cache purge failed" }`, which is indistinguishable from
    // every other fault — locating it took several rounds of guessing.
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi
        .fn()
        .mockRejectedValue(
          new TypeError("parameter 1 is not of type 'Options'"),
        ),
      request: purgeRequest(),
      secret: SECRET,
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      detail: "TypeError: parameter 1 is not of type 'Options'",
      error: "Cache purge failed",
      reason: "purge-threw",
    });
  });

  it("describes a non-Error throw by type without echoing its value", async () => {
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi.fn().mockRejectedValue("secret-bearing-string"),
      request: purgeRequest(),
      secret: SECRET,
    });

    expect(response.status).toBe(502);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe("string");
    expect(JSON.stringify(body)).not.toContain("secret-bearing-string");
  });

  it("bounds the thrown detail so a huge message cannot flood the log", async () => {
    const response = await handlePublicSsrCachePurgeRequest({
      purge: vi.fn().mockRejectedValue(new Error("x".repeat(5_000))),
      request: purgeRequest(),
      secret: SECRET,
    });

    const body = (await response.json()) as { detail: string };
    expect(body.detail).toHaveLength(200);
    expect(body.detail.startsWith("Error: ")).toBe(true);
  });
});
