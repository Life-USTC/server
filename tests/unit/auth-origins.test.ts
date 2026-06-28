import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthAllowedHosts,
  getAuthTrustedOrigins,
  isTrustedAuthOrigin,
} from "@/lib/auth/auth-origins";

describe("认证来源辅助函数", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("包含公开和固定的本地来源", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview-123.example.com");

    expect(getAuthTrustedOrigins()).toEqual([
      "https://preview-123.example.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("返回 Better Auth 允许的 host 以支持动态 base URL 解析", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview-123.example.com");

    expect(getAuthAllowedHosts()).toEqual([
      "preview-123.example.com",
      "localhost:3000",
      "127.0.0.1:3000",
    ]);
  });

  it("对匹配的公开和本地来源去重", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life-ustc.tiankaima.dev");

    expect(getAuthTrustedOrigins()).toEqual([
      "https://life-ustc.tiankaima.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("为自定义 localhost 端口包含回环 sibling 来源", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "http://localhost:3010");

    expect(getAuthTrustedOrigins()).toEqual([
      "http://localhost:3010",
      "http://127.0.0.1:3010",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });
});

describe("isTrustedAuthOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function withOrigin(current: string) {
    vi.stubEnv("APP_PUBLIC_ORIGIN", current);
  }

  it("接受与当前公开来源的精确匹配", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://preview.example.com")).toBe(true);
  });

  it("接受始终受信任的 http://localhost:3000", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("http://localhost:3000")).toBe(true);
  });

  it("接受始终受信任的 http://127.0.0.1:3000", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("接受自定义本地公开来源的回环 sibling", () => {
    withOrigin("http://127.0.0.1:3010");
    expect(isTrustedAuthOrigin("http://localhost:3010")).toBe(true);
  });

  it("拒绝未配置的示例来源", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://example.com")).toBe(false);
    expect(isTrustedAuthOrigin("https://myapp-abc123.example.com")).toBe(false);
  });

  it("拒绝精确匹配受信来源上的不同端口", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://preview.example.com:8443")).toBe(false);
  });

  it("拒绝未知来源", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://evil.example.com")).toBe(false);
  });

  it("对非 URL 字符串返回 false 且不抛出", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("not-a-url")).toBe(false);
  });

  it("在匹配前规范化来源（去除路径和查询）", () => {
    withOrigin("https://preview.example.com");
    // new URL(origin).origin strips path — should still match
    expect(
      isTrustedAuthOrigin("https://preview.example.com/some/path?q=1"),
    ).toBe(true);
  });
});
