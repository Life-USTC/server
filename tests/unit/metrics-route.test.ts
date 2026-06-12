import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/routes/api/metrics/+server";

describe("metrics route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows direct localhost reads without a token", async () => {
    const response = GET({
      request: new Request("http://127.0.0.1:3000/api/metrics"),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain(
      "# Life USTC runtime metrics",
    );
  });

  it("hides metrics from public hosts unless a token is configured", () => {
    const response = GET({
      request: new Request("https://life.example.com/api/metrics"),
    });

    expect(response.status).toBe(404);
  });

  it("requires the configured bearer token", () => {
    vi.stubEnv("METRICS_BEARER_TOKEN", "secret-token");

    expect(
      GET({
        request: new Request("https://life.example.com/api/metrics", {
          headers: { Authorization: "Bearer secret-token" },
        }),
      }).status,
    ).toBe(200);
    expect(
      GET({
        request: new Request("http://127.0.0.1:3000/api/metrics"),
      }).status,
    ).toBe(200);
  });

  it("allows IPv6 loopback host headers", () => {
    const response = GET({
      request: new Request("http://[::1]:3000/api/metrics", {
        headers: { Host: "[::1]:3000" },
      }),
    });

    expect(response.status).toBe(200);
  });
});
