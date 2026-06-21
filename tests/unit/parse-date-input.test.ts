import { describe, expect, test } from "vitest";
import { parseDateInput } from "@/lib/time/parse-date-input";

describe("parseDateInput", () => {
  test("returns null for empty-like values", () => {
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput("   ")).toBeNull();
  });

  test("parses explicit timezone input as-is", () => {
    const parsed = parseDateInput("2026-03-26T12:00:00+08:00");
    expect(parsed?.toISOString()).toBe("2026-03-26T04:00:00.000Z");
  });

  test("interprets timezone-less datetime in Asia/Shanghai", () => {
    const parsed = parseDateInput("2026-03-26T12:00");
    expect(parsed?.toISOString()).toBe("2026-03-26T04:00:00.000Z");
  });

  test("interprets date-only string as UTC midnight", () => {
    const parsed = parseDateInput("2026-03-26");
    expect(parsed?.toISOString()).toBe("2026-03-26T00:00:00.000Z");
  });

  test("returns undefined for invalid input", () => {
    expect(parseDateInput("not-a-date")).toBeUndefined();
  });

  test("rejects overflowing calendar dates", () => {
    expect(parseDateInput("2026-02-31")).toBeUndefined();
    expect(parseDateInput("2026-13-01")).toBeUndefined();
    expect(parseDateInput("2026-02-31T12:00")).toBeUndefined();
    expect(parseDateInput("2026-02-31T12:00:00Z")).toBeUndefined();
    expect(parseDateInput("2026-02-31T12:00:00+08:00")).toBeUndefined();
    expect(parseDateInput("2026-2-31")).toBeUndefined();
    expect(parseDateInput("2026/02/31")).toBeUndefined();
    expect(parseDateInput("2026.02.31")).toBeUndefined();
    expect(parseDateInput("02/31/2026")).toBeUndefined();
    expect(parseDateInput("2/31/2026")).toBeUndefined();
    expect(parseDateInput("02.31.2026")).toBeUndefined();
  });

  test("rejects unsupported non-YMD numeric dates", () => {
    expect(parseDateInput("03/26/2026")).toBeUndefined();
  });
});
