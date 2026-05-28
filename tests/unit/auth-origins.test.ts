import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthAllowedHosts,
  getAuthTrustedOrigins,
  isTrustedAuthOrigin,
} from "@/lib/auth/auth-origins";

describe("auth origin helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes current, canonical, localhost, and vercel preview origins", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview-123.vercel.app");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life-ustc.tiankaima.dev");

    expect(getAuthTrustedOrigins()).toEqual([
      "https://preview-123.vercel.app",
      "https://life-ustc.tiankaima.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://*.vercel.app",
    ]);
  });

  it("returns Better Auth allowed hosts for dynamic base URL resolution", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview-123.vercel.app");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life-ustc.tiankaima.dev");

    expect(getAuthAllowedHosts()).toEqual([
      "preview-123.vercel.app",
      "life-ustc.tiankaima.dev",
      "localhost:3000",
      "127.0.0.1:3000",
      "*.vercel.app",
    ]);
  });

  it("deduplicates matching public and canonical origins", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life-ustc.tiankaima.dev");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life-ustc.tiankaima.dev");

    expect(getAuthTrustedOrigins()).toEqual([
      "https://life-ustc.tiankaima.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://*.vercel.app",
    ]);
  });
});

describe("isTrustedAuthOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function withOrigins(current: string, canonical: string) {
    vi.stubEnv("APP_PUBLIC_ORIGIN", current);
    vi.stubEnv("APP_CANONICAL_ORIGIN", canonical);
  }

  it("accepts an exact match against the current public origin", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("https://preview.example.com")).toBe(true);
  });

  it("accepts an exact match against the canonical origin", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("https://life.example.com")).toBe(true);
  });

  it("accepts http://localhost:3000 which is always trusted", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("http://localhost:3000")).toBe(true);
  });

  it("accepts http://127.0.0.1:3000 which is always trusted", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("accepts a wildcard subdomain matching https://*.vercel.app", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("https://myapp-abc123.vercel.app")).toBe(true);
  });

  it("rejects the bare wildcard base domain (no subdomain)", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    // 'vercel.app' has no subdomain — wildcard '*.vercel.app' should not match
    expect(isTrustedAuthOrigin("https://vercel.app")).toBe(false);
  });

  it("rejects a different base domain that shares a suffix", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    // 'notvercel.app' is not '.vercel.app'
    expect(isTrustedAuthOrigin("https://app.notvercel.app")).toBe(false);
  });

  it("rejects wrong protocol on wildcard pattern", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    // The wildcard is https://*.vercel.app; http:// must not match
    expect(isTrustedAuthOrigin("http://sub.vercel.app")).toBe(false);
  });

  it("rejects a different port on an exact-match trusted origin", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("https://preview.example.com:8443")).toBe(false);
  });

  it("rejects an unknown origin", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("https://evil.example.com")).toBe(false);
  });

  it("returns false for a non-URL string without throwing", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    expect(isTrustedAuthOrigin("not-a-url")).toBe(false);
  });

  it("normalises origin before matching (strips path/query)", () => {
    withOrigins("https://preview.example.com", "https://life.example.com");
    // new URL(origin).origin strips path — should still match
    expect(
      isTrustedAuthOrigin("https://preview.example.com/some/path?q=1"),
    ).toBe(true);
  });
});
