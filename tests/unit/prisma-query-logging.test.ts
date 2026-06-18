import { afterEach, describe, expect, it, vi } from "vitest";
import { logPrismaQuery } from "@/lib/db/prisma-query-events";
import {
  getPrismaQueryDebugMode,
  getPrismaSlowQueryThresholdMs,
  shouldEnablePrismaQueryLogging,
} from "@/lib/db/prisma-query-logging";

describe("prisma query logging env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    [{}, "off"],
    [{ PRISMA_QUERY_DEBUG: "0" }, "off"],
    [{ PRISMA_QUERY_DEBUG: "1" }, "standard"],
    [{ PRISMA_QUERY_DEBUG: "true" }, "standard"],
    [{ PRISMA_QUERY_DEBUG: " yes " }, "standard"],
    [{ PRISMA_QUERY_DEBUG: " verbose " }, "verbose"],
  ] as const)("resolves debug mode from %o", (input, expected) => {
    expect(getPrismaQueryDebugMode(input)).toBe(expected);
  });

  it("parses slow query threshold as an exact non-negative integer", () => {
    expect(getPrismaSlowQueryThresholdMs({ PRISMA_SLOW_QUERY_MS: "0" })).toBe(
      0,
    );
    expect(
      getPrismaSlowQueryThresholdMs({ PRISMA_SLOW_QUERY_MS: " 250 " }),
    ).toBe(250);
    expect(
      getPrismaSlowQueryThresholdMs({ PRISMA_SLOW_QUERY_MS: "250ms" }),
    ).toBeNull();
    expect(
      getPrismaSlowQueryThresholdMs({ PRISMA_SLOW_QUERY_MS: "1.5" }),
    ).toBeNull();
    expect(
      getPrismaSlowQueryThresholdMs({ PRISMA_SLOW_QUERY_MS: "-1" }),
    ).toBeNull();
  });

  it("enables query logging for debug mode or slow query threshold", () => {
    expect(shouldEnablePrismaQueryLogging({})).toBe(false);
    expect(shouldEnablePrismaQueryLogging({ PRISMA_QUERY_DEBUG: "true" })).toBe(
      true,
    );
    expect(shouldEnablePrismaQueryLogging({ PRISMA_SLOW_QUERY_MS: "0" })).toBe(
      true,
    );
  });

  it("omits verbose query params from production logs", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRISMA_QUERY_DEBUG", "verbose");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logPrismaQuery({
      duration: 1,
      params: '["secret-user-id"]',
      query: "SELECT $1",
      target: "quaint::connector::metrics",
    } as Parameters<typeof logPrismaQuery>[0]);

    expect(infoSpy).toHaveBeenCalledOnce();
    const [payload] = infoSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      event: "prisma.query",
      environment: "production",
      query: "SELECT $1",
    });
    expect(String(payload)).not.toContain("secret-user-id");
    expect(JSON.parse(String(payload))).not.toHaveProperty("params");
  });
});
