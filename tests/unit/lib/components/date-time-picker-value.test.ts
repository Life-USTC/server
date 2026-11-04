import { describe, expect, it } from "vitest";
import {
  dateTimeLocalValue,
  parseDateTimeLocal,
} from "@/lib/components/date-time-picker-value";

describe("date-time local input", () => {
  it("retains civil date and minute precision without timezone conversion", () => {
    const value = parseDateTimeLocal("2028-02-29T14:30");
    expect(value?.date.toString()).toBe("2028-02-29");
    expect(value?.time).toBe("14:30");
    expect(dateTimeLocalValue(value?.date, "09:05", "23:59")).toBe(
      "2028-02-29T09:05",
    );
    expect(dateTimeLocalValue(undefined, "09:05", "23:59")).toBe("");
  });
  it.each([
    "2026-02-29T14:30",
    "2026-13-01T14:30",
    "2026-00-01T14:30",
    "2026-11-31T14:30",
    "2026-11-05T24:30",
    "2026-11-05T14:60",
    "2026-11-05T14:30junk",
    "0000-01-01T00:00",
    "",
  ])("rejects invalid draft %s", (value) => {
    expect(parseDateTimeLocal(value)).toBeNull();
  });
});
