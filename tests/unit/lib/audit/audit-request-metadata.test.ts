import { describe, expect, it } from "vitest";
import { getAuditRequestMetadata } from "@/lib/audit/request-metadata";
import { setApiRequestObservabilityContext } from "@/lib/log/api-observability-context";

describe("getAuditRequestMetadata", () => {
  it("只使用 Cloudflare 已验证的客户端地址并生成应用请求 ID", () => {
    const request = new Request("https://example.test", {
      headers: {
        "user-agent": "vitest-agent",
        "cf-connecting-ip": "192.0.2.30",
        "cf-ray": "edge-ray-1",
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": "198.51.100.20",
      },
    });

    expect(getAuditRequestMetadata(request)).toMatchObject({
      ipAddress: "192.0.2.30",
      userAgent: "vitest-agent",
    });
    expect(getAuditRequestMetadata(request).requestId).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });

  it("不信任调用方可伪造的代理地址或请求 ID", () => {
    const request = new Request("https://example.test", {
      headers: {
        "x-real-ip": "198.51.100.20",
        "x-request-id": "client-controlled-id",
        "cf-ray": "client-controlled-ray",
      },
    });

    expect(getAuditRequestMetadata(request)).toMatchObject({
      ipAddress: undefined,
      userAgent: undefined,
    });
    expect(getAuditRequestMetadata(request).requestId).not.toBe(
      "client-controlled-id",
    );
    expect(getAuditRequestMetadata(request).requestId).not.toBe(
      "client-controlled-ray",
    );
  });

  it("忽略 forwarded 地址并限制可变请求头长度", () => {
    const request = new Request("https://example.test", {
      headers: {
        "user-agent": "a".repeat(600),
        "x-forwarded-for": "203.0.113.10, 198.51.100.20",
        "x-request-id": "client-controlled-id",
      },
    });

    expect(getAuditRequestMetadata(request)).toMatchObject({
      ipAddress: undefined,
      userAgent: "a".repeat(512),
    });
    expect(getAuditRequestMetadata(request).requestId).not.toBe(
      "client-controlled-id",
    );
  });

  it("优先使用应用观测上下文中的可信 request ID", () => {
    const request = new Request("https://example.test", {
      headers: { "x-request-id": "client-controlled-id" },
    });
    setApiRequestObservabilityContext(request, {
      requestId: "application-request-id",
      startMs: 1,
    });

    expect(getAuditRequestMetadata(request).requestId).toBe(
      "application-request-id",
    );
  });

  it("允许页面动作传入 hook 生成的可信 request ID", () => {
    const request = new Request("https://example.test");

    expect(
      getAuditRequestMetadata(request, "locals-request-id").requestId,
    ).toBe("locals-request-id");
  });
});
