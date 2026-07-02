import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
  formActionSourceFromOAuthRedirectUri,
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

  it("默认不全局允许外部 OAuth 回调来源", () => {
    const policy = buildContentSecurityPolicy("abc123");
    const formDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("form-action"));

    expect(formDirective).toBeDefined();
    expect(formDirective).toContain("'self'");
    expect(formDirective).toContain("http://localhost:*");
    expect(formDirective).not.toContain("https://chatgpt.com");
    expect(formDirective).not.toContain("https://www.perplexity.ai");
    expect(formDirective?.split(/\s+/)).not.toContain("https:");
    expect(formDirective).not.toContain("https://*");
  });

  it("允许按响应添加 OAuth 回调 form-action 来源", () => {
    const policy = buildContentSecurityPolicy("abc123", {
      formActionSources: ["https://client.example"],
    });
    const formDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("form-action"));

    expect(formDirective).toContain("'self'");
    expect(formDirective).toContain("https://client.example");
    expect(formDirective?.split(/\s+/)).not.toContain("https:");
  });

  it("从 OAuth redirect_uri 提取可用于 form-action 的来源", () => {
    expect(
      formActionSourceFromOAuthRedirectUri("https://client.example/callback"),
    ).toBe("https://client.example");
    expect(
      formActionSourceFromOAuthRedirectUri(
        "https://client.example:8443/callback",
      ),
    ).toBe("https://client.example:8443");
    expect(
      formActionSourceFromOAuthRedirectUri(
        "http://127.0.0.1:3456/oauth/callback",
      ),
    ).toBe("http://127.0.0.1:3456");
  });

  it("拒绝不适合作为 OAuth form-action 来源的 redirect_uri", () => {
    expect(
      formActionSourceFromOAuthRedirectUri("http://client.example/callback"),
    ).toBeUndefined();
    expect(
      formActionSourceFromOAuthRedirectUri("javascript:alert(1)"),
    ).toBeUndefined();
    expect(formActionSourceFromOAuthRedirectUri("not a url")).toBeUndefined();
  });
});
