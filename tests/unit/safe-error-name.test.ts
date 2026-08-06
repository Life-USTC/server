import { describe, expect, it } from "vitest";
import { getSafeErrorName } from "@/lib/log/safe-error-name";

describe("safe error names", () => {
  it("keeps allowlisted runtime error classes", () => {
    expect(getSafeErrorName(new TypeError("private detail"))).toBe("TypeError");
    expect(getSafeErrorName(new AggregateError([]))).toBe("AggregateError");
  });

  it("maps node-pg DatabaseError name to PostgresError", () => {
    const error = new Error("permission denied for column calendarFeedToken");
    error.name = "error";

    expect(getSafeErrorName(error)).toBe("PostgresError");
  });

  it("accepts duck-typed DriverAdapterError names without instanceof", () => {
    expect(getSafeErrorName({ name: "DriverAdapterError" })).toBe(
      "DriverAdapterError",
    );
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
