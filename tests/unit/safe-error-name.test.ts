import { describe, expect, it } from "vitest";
import { getSafeErrorName } from "@/lib/log/safe-error-name";

describe("safe error names", () => {
  it("keeps allowlisted runtime error classes", () => {
    expect(getSafeErrorName(new TypeError("private detail"))).toBe("TypeError");
  });

  it("rejects arbitrary error names even when they look like identifiers", () => {
    const error = new Error("private detail");
    error.name = "ApiKeyABC123";

    expect(getSafeErrorName(error)).toBe("UnknownError");
  });

  it("rejects non-errors", () => {
    expect(getSafeErrorName("private detail")).toBe("UnknownError");
  });
});
