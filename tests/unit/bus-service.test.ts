import { describe, expect, it } from "vitest";
import { parseBusTimeMinutes } from "@/features/bus/lib/bus-time";

describe("bus service", () => {
  it("parses exact HH:mm timetable values", () => {
    expect(parseBusTimeMinutes("08:05")).toBe(8 * 60 + 5);
    expect(parseBusTimeMinutes("8:05")).toBe(8 * 60 + 5);
    expect(parseBusTimeMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("rejects malformed or out-of-range timetable values", () => {
    expect(parseBusTimeMinutes(null)).toBeNull();
    expect(parseBusTimeMinutes("08:05x")).toBeNull();
    expect(parseBusTimeMinutes("08:5")).toBeNull();
    expect(parseBusTimeMinutes("24:00")).toBeNull();
    expect(parseBusTimeMinutes("08:60")).toBeNull();
  });
});
