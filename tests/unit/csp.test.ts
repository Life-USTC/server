import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
} from "@/lib/security/csp";

describe("csp helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a non-empty nonce", () => {
    const nonce = createScriptNonce();
    expect(nonce.length).toBeGreaterThan(10);
  });

  it("builds a CSP that requires a matching script nonce", () => {
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

  it("allows configured external avatar image sources", () => {
    const policy = buildContentSecurityPolicy("abc123");
    const imageDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("img-src"));

    expect(imageDirective).toBeDefined();
    expect(imageDirective).toContain("https://avatars.githubusercontent.com");
    expect(imageDirective).toContain("https://*.googleusercontent.com");
    expect(imageDirective).toContain("https://api.dicebear.com");
  });

  it("keeps uploads on the same origin", () => {
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
