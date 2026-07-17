import { describe, expect, it } from "vitest";
import {
  normalizeGraphqlShanghaiCalendarDate,
  validateGraphqlDateRange,
} from "@/lib/graphql/viewer-input";

describe("GraphQL viewer date input", () => {
  it.each([
    ["2026-04-29T00:00:00+08:00", "2026-04-29T00:00:00.000Z"],
    ["2026-04-28T16:00:00Z", "2026-04-29T00:00:00.000Z"],
    ["2026-04-29T16:00:00Z", "2026-04-30T00:00:00.000Z"],
  ])("normalizes %s to its Asia/Shanghai calendar date", (value, expected) => {
    expect(
      normalizeGraphqlShanghaiCalendarDate(value, "dateFrom").toISOString(),
    ).toBe(expected);
  });

  it("returns a safe BAD_USER_INPUT error for an invalid value", () => {
    expect(() =>
      normalizeGraphqlShanghaiCalendarDate("invalid", "dateFrom"),
    ).toThrow(
      expect.objectContaining({
        extensions: { code: "BAD_USER_INPUT" },
      }),
    );
  });

  it("accepts open and equal ranges", () => {
    const date = new Date("2026-04-29T00:00:00.000Z");

    expect(validateGraphqlDateRange(undefined, date)).toBeUndefined();
    expect(validateGraphqlDateRange(date, date)).toBeUndefined();
  });

  it("rejects an inverted range", () => {
    expect(() =>
      validateGraphqlDateRange(
        new Date("2026-04-30T00:00:00.000Z"),
        new Date("2026-04-29T00:00:00.000Z"),
      ),
    ).toThrow(
      expect.objectContaining({
        extensions: { code: "BAD_USER_INPUT" },
      }),
    );
  });
});
