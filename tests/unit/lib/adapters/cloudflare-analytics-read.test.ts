import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CloudflareAnalyticsReadUnavailableError,
  clearCloudflareAnalyticsReadCache,
  getCloudflareAnalyticsReadPort,
} from "@/lib/adapters/cloudflare-analytics-read";

const sql = "SELECT 1 FORMAT JSON";

describe("Cloudflare Analytics Engine read adapter", () => {
  beforeEach(() => {
    clearCloudflareAnalyticsReadCache();
    vi.stubEnv("CLOUDFLARE_ANALYTICS_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("CLOUDFLARE_ANALYTICS_API_TOKEN", "analytics-read-token");
  });

  afterEach(() => {
    clearCloudflareAnalyticsReadCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed without configured credentials", async () => {
    vi.stubEnv("CLOUDFLARE_ANALYTICS_ACCOUNT_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCloudflareAnalyticsReadPort().query(sql)).rejects.toEqual(
      expect.objectContaining<Partial<CloudflareAnalyticsReadUnavailableError>>(
        {
          reason: "not_configured",
        },
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the account id and sends a server-only POST", async () => {
    vi.stubEnv("CLOUDFLARE_ANALYTICS_ACCOUNT_ID", "not-an-account");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCloudflareAnalyticsReadPort().query(sql)).rejects.toEqual(
      expect.objectContaining({ reason: "invalid_config" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("CLOUDFLARE_ANALYTICS_ACCOUNT_ID", "b".repeat(32));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ value: 1 }] }), { status: 200 }),
    );
    await getCloudflareAnalyticsReadPort().query(sql);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/accounts/${"b".repeat(32)}/analytics_engine/sql`,
      expect.objectContaining({
        body: sql,
        headers: expect.objectContaining({
          Authorization: "Bearer analytics-read-token",
        }),
        method: "POST",
      }),
    );
  });

  it("coalesces concurrent reads and caches only successful responses", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const port = getCloudflareAnalyticsReadPort();

    const first = port.query(sql);
    const second = port.query(sql);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse?.(
      new Response(JSON.stringify({ data: [{ value: 1 }] }), { status: 200 }),
    );
    await expect(Promise.all([first, second])).resolves.toEqual([
      [{ value: 1 }],
      [{ value: 1 }],
    ]);
    await expect(port.query(sql)).resolves.toEqual([{ value: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearCloudflareAnalyticsReadCache();
    fetchMock.mockRejectedValueOnce(new Error("temporary"));
    await expect(port.query(sql)).rejects.toThrow("temporary");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ value: 2 }] }), { status: 200 }),
    );
    await expect(port.query(sql)).resolves.toEqual([{ value: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("revalidates credentials before cache hits and partitions rotated credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ value: 1 }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ value: 2 }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const port = getCloudflareAnalyticsReadPort();

    await expect(port.query(sql)).resolves.toEqual([{ value: 1 }]);

    vi.stubEnv("CLOUDFLARE_ANALYTICS_API_TOKEN", "rotated-token");
    await expect(port.query(sql)).resolves.toEqual([{ value: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.stubEnv("CLOUDFLARE_ANALYTICS_API_TOKEN", "");
    await expect(port.query(sql)).rejects.toEqual(
      expect.objectContaining({ reason: "not_configured" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
