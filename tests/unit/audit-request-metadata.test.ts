import { describe, expect, it } from "vitest";
import { getAuditRequestMetadata } from "@/lib/audit/request-metadata";

describe("getAuditRequestMetadata", () => {
  it("优先使用 x-forwarded-for", () => {
    const request = new Request("https://example.test", {
      headers: {
        "user-agent": "vitest-agent",
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": "198.51.100.20",
      },
    });

    expect(getAuditRequestMetadata(request)).toEqual({
      ipAddress: "203.0.113.10",
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
      userAgent: undefined,
    });
  });
});
