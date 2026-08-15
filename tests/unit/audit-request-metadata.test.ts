import { describe, expect, it } from "vitest";
import { getAuditRequestMetadata } from "@/lib/audit/request-metadata";

describe("getAuditRequestMetadata", () => {
  it("优先使用 Cloudflare 已验证的客户端地址与请求 ID", () => {
    const request = new Request("https://example.test", {
      headers: {
        "user-agent": "vitest-agent",
        "cf-connecting-ip": "192.0.2.30",
        "cf-ray": "ray-1",
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": "198.51.100.20",
      },
    });

    expect(getAuditRequestMetadata(request)).toEqual({
      ipAddress: "192.0.2.30",
      requestId: "ray-1",
      userAgent: "vitest-agent",
    });
  });

  it("回退到 x-real-ip 并省略缺失标头", () => {
    const request = new Request("https://example.test", {
      headers: {
        "x-real-ip": "198.51.100.20",
      },
    });

    expect(getAuditRequestMetadata(request)).toEqual({
      ipAddress: "198.51.100.20",
      requestId: undefined,
      userAgent: undefined,
    });
  });

  it("只保留 x-forwarded-for 的首个地址并限制可变请求头长度", () => {
    const request = new Request("https://example.test", {
      headers: {
        "user-agent": "a".repeat(600),
        "x-forwarded-for": "203.0.113.10, 198.51.100.20",
        "x-request-id": "r".repeat(200),
      },
    });

    expect(getAuditRequestMetadata(request)).toEqual({
      ipAddress: "203.0.113.10",
      requestId: "r".repeat(128),
      userAgent: "a".repeat(512),
    });
  });
});
