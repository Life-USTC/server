import { describe, expect, it } from "vitest";
import {
  getPrismaQueryDebugMode,
  getPrismaSlowQueryThresholdMs,
  shouldEnablePrismaQueryLogging,
} from "@/lib/db/prisma-query-logging";

describe("prisma query logging env", () => {
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
});
