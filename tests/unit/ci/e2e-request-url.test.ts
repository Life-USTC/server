import { describe, expect, it } from "vitest";
import { absoluteTestUrl } from "../../e2e/utils/request-url";

describe("E2E request URL", () => {
  it("resolves request paths against the supplied private origin", () => {
    expect(absoluteTestUrl("/api/mcp", "http://localhost:3103")).toBe(
      "http://localhost:3103/api/mcp",
    );
  });

  it("rejects a missing origin instead of selecting a shared server", () => {
    expect(() => absoluteTestUrl("/api/mcp", undefined)).toThrow(
      "A private test origin is required",
    );
  });
});
