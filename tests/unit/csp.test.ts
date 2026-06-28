import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
} from "@/lib/security/csp";

describe("CSP 辅助函数", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("创建非空 nonce", () => {
    const nonce = createScriptNonce();
    expect(nonce.length).toBeGreaterThan(10);
  });

  it("构建要求匹配脚本 nonce 的 CSP", () => {
    const policy = buildContentSecurityPolicy("abc123");
    const scriptDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(policy).toContain("script-src 'self' 'nonce-abc123'");
    expect(scriptDirective).toBeDefined();
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(scriptDirective).not.toContain("'unsafe-eval'");
    expect(scriptDirective).not.toContain("unpkg.com");
    expect(policy).toContain("object-src 'none'");
  });

  it("允许配置的外部头像图片来源", () => {
    const policy = buildContentSecurityPolicy("abc123");
    const imageDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("img-src"));

    expect(imageDirective).toBeDefined();
    expect(imageDirective).toContain("https://avatars.githubusercontent.com");
    expect(imageDirective).toContain("https://*.googleusercontent.com");
    expect(imageDirective).toContain("https://api.dicebear.com");
  });

  it("保持上传资源同源", () => {
    const policy = buildContentSecurityPolicy("abc123");
    const connectDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("connect-src"));

    expect(connectDirective).toBeDefined();
    expect(connectDirective).toContain("'self'");
    expect(connectDirective).not.toContain("amazonaws.com");
    expect(connectDirective).not.toContain("r2.cloudflarestorage.com");
  });
});
