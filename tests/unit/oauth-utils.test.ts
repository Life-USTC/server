import { describe, expect, it } from "vitest";
import {
  hashOAuthClientSecretForDbStorage,
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

describe("oauth/utils", () => {
  it("hashes client secrets deterministically with SHA-256 base64url", () => {
    const secret = "super-secret-value";
    const hash = hashOAuthClientSecretForDbStorage(secret);

    expect(hash).not.toBe(secret);
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    // Same input produces the same hash
    expect(hashOAuthClientSecretForDbStorage(secret)).toBe(hash);
    // Different input produces a different hash
    expect(hashOAuthClientSecretForDbStorage("other-secret")).not.toBe(hash);
  });

  it("normalizes resource indicators", () => {
    expect(normalizeResourceIndicator("https://Example.COM/api/")).toBe(
      "https://example.com/api/",
    );
    expect(normalizeResourceIndicator("https://example.com:443/api")).toBe(
      "https://example.com/api",
    );
    expect(normalizeResourceIndicator("http://example.com:8080/api")).toBe(
      "http://example.com:8080/api",
    );
  });

  it("strips fragments from resource indicators", () => {
    expect(normalizeResourceIndicator("https://example.com/api#frag")).toBe(
      "https://example.com/api",
    );
  });

  it("matches equivalent resource indicators", () => {
    expect(
      resourceIndicatorsMatch(
        "https://Example.COM/api",
        "https://example.com/api",
      ),
    ).toBe(true);
    expect(
      resourceIndicatorsMatch(
        "https://example.com:443/api",
        "https://example.com/api",
      ),
    ).toBe(true);
    expect(
      resourceIndicatorsMatch(
        "https://example.com/api",
        "https://example.com/other",
      ),
    ).toBe(false);
  });
});
