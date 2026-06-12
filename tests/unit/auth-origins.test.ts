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

  it("includes public and pinned local origins", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview-123.vercel.app");

    expect(getAuthTrustedOrigins()).toEqual([
      "https://preview-123.vercel.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("returns Better Auth allowed hosts for dynamic base URL resolution", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview-123.vercel.app");

    expect(getAuthAllowedHosts()).toEqual([
      "preview-123.vercel.app",
      "localhost:3000",
      "127.0.0.1:3000",
    ]);
  });

  it("deduplicates matching public and local origins", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life-ustc.tiankaima.dev");

    expect(getAuthTrustedOrigins()).toEqual([
      "https://life-ustc.tiankaima.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("includes loopback sibling origin for custom localhost ports", () => {
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

  it("accepts an exact match against the current public origin", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://preview.example.com")).toBe(true);
  });

  it("accepts http://localhost:3000 which is always trusted", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("http://localhost:3000")).toBe(true);
  });

  it("accepts http://127.0.0.1:3000 which is always trusted", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("accepts the loopback sibling for a custom local public origin", () => {
    withOrigin("http://127.0.0.1:3010");
    expect(isTrustedAuthOrigin("http://localhost:3010")).toBe(true);
  });

  it("rejects unconfigured Vercel origins", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://vercel.app")).toBe(false);
    expect(isTrustedAuthOrigin("https://myapp-abc123.vercel.app")).toBe(false);
  });

  it("rejects a different port on an exact-match trusted origin", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://preview.example.com:8443")).toBe(false);
  });

  it("rejects an unknown origin", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("https://evil.example.com")).toBe(false);
  });

  it("returns false for a non-URL string without throwing", () => {
    withOrigin("https://preview.example.com");
    expect(isTrustedAuthOrigin("not-a-url")).toBe(false);
  });

  it("normalises origin before matching (strips path/query)", () => {
    withOrigin("https://preview.example.com");
    // new URL(origin).origin strips path — should still match
    expect(
      isTrustedAuthOrigin("https://preview.example.com/some/path?q=1"),
    ).toBe(true);
  });
});
