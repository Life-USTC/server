import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/routes/api/metrics/+server";

describe("metrics 路由", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("允许 localhost 直接读取而无需 token", async () => {
    const response = GET({
      request: new Request("http://127.0.0.1:3000/api/metrics"),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain(
      "# Life USTC runtime metrics",
    );
  });

  it("未配置 token 时对 public host 隐藏指标", () => {
    const response = GET({
      request: new Request("https://life.example.com/api/metrics"),
    });

    expect(response.status).toBe(404);
  });

  it("要求配置的 bearer token", () => {
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

  it("允许 IPv6 loopback host 请求头", () => {
    const response = GET({
      request: new Request("http://[::1]:3000/api/metrics", {
        headers: { Host: "[::1]:3000" },
      }),
    });

    expect(response.status).toBe(200);
  });
});
