import { describe, expect, it } from "vitest";
import { resolveE2EBaseUrl } from "../e2e/utils/base-url";
import { absoluteTestUrl } from "../e2e/utils/request-url";

describe("E2E base URL", () => {
  it("defaults to the standard local Playwright origin", () => {
    expect(resolveE2EBaseUrl({})).toBe("http://localhost:3000");
  });

  it("uses the isolated shard port", () => {
    expect(resolveE2EBaseUrl({ E2E_PORT: "3102" })).toBe(
      "http://localhost:3102",
    );
  });

  it("prefers an explicit Playwright base URL", () => {
    expect(
      resolveE2EBaseUrl({
        E2E_PORT: "3102",
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:4100/ignored-path",
      }),
    ).toBe("http://127.0.0.1:4100");
  });

  it("resolves request paths against a supplied project URL", () => {
    expect(absoluteTestUrl("/api/mcp", "http://localhost:3103")).toBe(
      "http://localhost:3103/api/mcp",
    );
  });

  it("rejects an invalid shard port", () => {
    expect(() => resolveE2EBaseUrl({ E2E_PORT: "not-a-port" })).toThrow(
      "E2E_PORT must be a numeric TCP port.",
    );
  });
});
