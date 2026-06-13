import { afterEach, describe, expect, it, vi } from "vitest";
import { logAppEvent, logRouteFailure, shouldLog } from "@/lib/log/app-logger";

describe("app logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("honors configured log levels", () => {
    vi.stubEnv("LOG_LEVEL", "warn");

    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("info")).toBe(false);
    expect(shouldLog("warn")).toBe(true);
    expect(shouldLog("error")).toBe(true);
  });

  it("normalizes logger-only environment values", () => {
    vi.stubEnv("LOG_LEVEL", " WARN ");

    expect(shouldLog("info")).toBe(false);
    expect(shouldLog("warn")).toBe(true);
  });

  it("falls back to info for invalid log levels", () => {
    vi.stubEnv("LOG_LEVEL", "verbose");

    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("info")).toBe(true);
  });

  it("suppresses non-server route failures in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logRouteFailure("Bad request", 400, new Error("invalid"));

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs server route failures as structured production JSON", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logRouteFailure("Server failure", 500, new Error("boom"), {
      route: "/api/test",
    });

    expect(errorSpy).toHaveBeenCalledOnce();
    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      prefix: "[app]",
      environment: "production",
      message: "Server failure",
      status: 500,
      route: "/api/test",
      error: {
        name: "Error",
        message: "boom",
      },
    });
    expect(String(payload)).not.toContain("stack");
  });

  it("emits app events as structured production JSON", () => {
    vi.stubEnv("NODE_ENV", "production");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logAppEvent("info", "test.event", { requestId: "req_123" });

    expect(infoSpy).toHaveBeenCalledOnce();
    const [payload] = infoSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      prefix: "[app]",
      environment: "production",
      runtime: "server",
      message: "test.event",
      requestId: "req_123",
    });
  });
});
