import { describe, expect, it } from "vitest";
import {
  hashOAuthClientSecretForDbStorage,
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

describe("oauth/utils", () => {
  it("hashes client secrets deterministically with SHA-256 base64url", async () => {
    const secret = "super-secret-value";
    const hash = await hashOAuthClientSecretForDbStorage(secret);

    expect(hash).not.toBe(secret);
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    // Same input produces the same hash
    await expect(hashOAuthClientSecretForDbStorage(secret)).resolves.toBe(hash);
    // Different input produces a different hash
    await expect(
      hashOAuthClientSecretForDbStorage("other-secret"),
    ).resolves.not.toBe(hash);
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

  it("matches localhost and 127.0.0.1 resource indicators on the same port", () => {
    expect(
      resourceIndicatorsMatch(
        "http://localhost:3010/api/mcp",
        "http://127.0.0.1:3010/api/mcp",
      ),
    ).toBe(true);
  });

  it("rejects loopback resource indicators with different ports or paths", () => {
    expect(
      resourceIndicatorsMatch(
        "http://localhost:3010/api/mcp",
        "http://127.0.0.1:3000/api/mcp",
      ),
    ).toBe(false);
    expect(
      resourceIndicatorsMatch(
        "http://localhost:3010/api/mcp",
        "http://127.0.0.1:3010/api/other",
      ),
    ).toBe(false);
  });
});
