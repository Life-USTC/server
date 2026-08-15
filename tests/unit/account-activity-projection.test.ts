import { describe, expect, it } from "vitest";
import {
  maskAuditIpAddress,
  summarizeAuditUserAgent,
} from "@/features/settings/server/account-activity";

describe("account activity privacy projection", () => {
  it("掩码 IPv4 与 IPv6，不回显无法识别的值", () => {
    expect(maskAuditIpAddress("203.0.113.42")).toBe("203.0.113.*");
    expect(maskAuditIpAddress("2001:db8:abcd:12::1")).toBe(
      "2001:db8:abcd::/48",
    );
    expect(maskAuditIpAddress("forwarded-by-user")).toBeNull();
  });

  it("只返回设备族摘要，不回显完整 User-Agent", () => {
    const raw =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
    expect(summarizeAuditUserAgent(raw)).toBe("Chrome · Windows");
    expect(summarizeAuditUserAgent(raw)).not.toContain("130.0");
  });
});
