import { describe, expect, it } from "vitest";
import {
  hashOAuthClientSecretForDbStorage,
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

describe("oauth/utils", () => {
  it("使用 SHA-256 base64url 确定性哈希客户端密钥", async () => {
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

  it("规范化资源标识符", () => {
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

  it("去除资源标识符中的片段", () => {
    expect(normalizeResourceIndicator("https://example.com/api#frag")).toBe(
      "https://example.com/api",
    );
  });

  it("匹配等效资源标识符", () => {
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

  it("匹配相同端口下 localhost 与 127.0.0.1 资源标识符", () => {
    expect(
      resourceIndicatorsMatch(
        "http://localhost:3010/api/mcp",
        "http://127.0.0.1:3010/api/mcp",
      ),
    ).toBe(true);
  });

  it("拒绝不同端口或路径的环回资源标识符", () => {
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
