import { describe, expect, it } from "vitest";
import { getSafeErrorName } from "@/lib/log/safe-error-name";

/** Mirrors SvelteKit's non-Error HttpError (no `.name` property). */
class HttpError {
  status: number;
  body: { message: string };

  constructor(status: number, body: string) {
    this.status = status;
    this.body = { message: body };
  }
}

/** Mirrors SvelteKitError: extends Error but `.name` stays `"Error"`. */
class SvelteKitError extends Error {
  status: number;
  text: string;

  constructor(status: number, text: string, message: string) {
    super(message);
    this.status = status;
    this.text = text;
  }
}

class OpaqueRouteFailure extends Error {}

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

  it("accepts allowlisted SvelteKit error names", () => {
    expect(getSafeErrorName({ name: "HttpError" })).toBe("HttpError");
    expect(getSafeErrorName({ name: "Redirect" })).toBe("Redirect");
    expect(getSafeErrorName({ name: "SvelteKitError" })).toBe("SvelteKitError");
  });

  it("uses HttpError constructor name when .name is absent", () => {
    expect(getSafeErrorName(new HttpError(404, "secret path"))).toBe(
      "HttpError",
    );
  });

  it("prefers SvelteKitError constructor over generic Error.name", () => {
    const error = new SvelteKitError(404, "Not Found", "secret path");
    expect(error.name).toBe("Error");
    expect(getSafeErrorName(error)).toBe("SvelteKitError");
  });

  it("does not leak arbitrary .name values; falls back to constructor", () => {
    const error = new Error("private detail");
    error.name = "ApiKeyABC123";

    expect(getSafeErrorName(error)).toBe("Error");
  });

  it("uses custom constructor name when allowlist and cause miss", () => {
    expect(getSafeErrorName(new OpaqueRouteFailure("secret"))).toBe(
      "OpaqueRouteFailure",
    );
  });

  it("rejects constructor names that are not safe identifiers", () => {
    class LocalFailure {}
    Object.defineProperty(LocalFailure, "name", {
      configurable: true,
      value: "bad-name",
    });

    expect(getSafeErrorName(new LocalFailure())).toBe("UnknownError");
  });

  it("rejects oversized constructor names", () => {
    class LocalFailure {}
    Object.defineProperty(LocalFailure, "name", {
      configurable: true,
      value: `E${"x".repeat(64)}`,
    });

    expect(getSafeErrorName(new LocalFailure())).toBe("UnknownError");
  });

  it("rejects non-errors", () => {
    expect(getSafeErrorName("private detail")).toBe("UnknownError");
  });

  it("walks cause for allowlisted nested names", () => {
    const cause = new Error("permission denied");
    cause.name = "PrismaClientKnownRequestError";
    const wrapper = new Error("route failed");
    wrapper.name = "ApiKeyABC123";
    (wrapper as Error & { cause: Error }).cause = cause;

    expect(getSafeErrorName(wrapper)).toBe("PrismaClientKnownRequestError");
  });

  it("walks cause to HttpError constructor when wrapper name is unknown", () => {
    const wrapper = new Error("route failed");
    wrapper.name = "NotAllowlistedWrapper";
    (wrapper as Error & { cause: HttpError }).cause = new HttpError(
      403,
      "hidden",
    );

    expect(getSafeErrorName(wrapper)).toBe("HttpError");
  });
});
