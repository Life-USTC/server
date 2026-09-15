import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { servePrometheusMetrics } from "@/features/admin/server/prometheus-metrics";

const { read, render } = vi.hoisted(() => ({ read: vi.fn(), render: vi.fn() }));
vi.mock("@/features/admin/server/prometheus-metrics-data", () => ({
  readPrometheusMetrics: read,
}));
vi.mock("@/features/admin/server/prometheus-metrics-render", () => ({
  renderPrometheusMetrics: render,
}));

function request(authorization?: string, path = "/metrics", cookie?: string) {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  return new Request(`https://example.test${path}`, { headers });
}

describe("Prometheus scrape authorization", () => {
  beforeEach(() => {
    vi.stubEnv("METRICS_SECRET", "test-metrics-secret");
    read.mockReset().mockResolvedValue({});
    render.mockReset().mockReturnValue("# TYPE example gauge\nexample 1\n");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    undefined,
    "Bearer wrong",
    "Basic test-metrics-secret",
    "Bearer test-metrics-secret suffix",
    "Bearer test-metrics-secret,other",
    `Bearer ${"x".repeat(4097)}`,
  ])(
    "rejects invalid authorization without database access (%s)",
    async (authorization) => {
      const response = await servePrometheusMetrics(request(authorization));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe(
        'Bearer realm="metrics"',
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("fails closed without configuration", async () => {
    vi.stubEnv("METRICS_SECRET", "");
    expect(
      (await servePrometheusMetrics(request("Bearer test-metrics-secret")))
        .status,
    ).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });

  it("does not accept credentials in a query parameter or session cookie", async () => {
    expect(
      (
        await servePrometheusMetrics(
          request(
            undefined,
            "/metrics?secret=test-metrics-secret",
            "better-auth.session_token=test-metrics-secret",
          ),
        )
      ).status,
    ).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });

  it("serves an authenticated scrape with the Prometheus content type", async () => {
    const response = await servePrometheusMetrics(
      request("bEaReR test-metrics-secret"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; version=0.0.4; charset=utf-8",
    );
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
    expect(await response.text()).toBe("# TYPE example gauge\nexample 1\n");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("marks collection errors unavailable and never leaks error details", async () => {
    read.mockRejectedValue(new Error("private database connection detail"));
    const response = await servePrometheusMetrics(
      request("Bearer test-metrics-secret"),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Metrics unavailable\n");
    expect(render).not.toHaveBeenCalled();
  });
});
