import { describe, expect, it } from "vitest";
import {
  canonicalSectionsCalendarUrl,
  MAX_MULTI_SECTION_CALENDAR_IDS,
  parseSectionsCalendarIds,
} from "@/lib/api/routes/calendar-route-request";

function calendarRequest(sectionIds?: string) {
  const url = new URL("https://life.example/api/catalog/sections/calendar.ics");
  if (sectionIds !== undefined) url.searchParams.set("sectionIds", sectionIds);
  return new Request(url);
}

describe("multi-section calendar request", () => {
  it("accepts exactly 50 unique IDs", () => {
    const ids = Array.from(
      { length: MAX_MULTI_SECTION_CALENDAR_IDS },
      (_, index) => index + 1,
    );

    expect(parseSectionsCalendarIds(calendarRequest(ids.join(",")))).toEqual(
      ids,
    );
  });

  it("rejects 51 unique IDs", async () => {
    const ids = Array.from(
      { length: MAX_MULTI_SECTION_CALENDAR_IDS + 1 },
      (_, index) => index + 1,
    );
    const response = parseSectionsCalendarIds(calendarRequest(ids.join(",")));

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
    await expect((response as Response).json()).resolves.toEqual({
      error: "sectionIds must contain at most 50 unique IDs",
    });
  });

  it("deduplicates before enforcing the limit and sorts the canonical IDs", () => {
    const fiftyIds = Array.from(
      { length: MAX_MULTI_SECTION_CALENDAR_IDS },
      (_, index) => index + 1,
    );
    const input = [...fiftyIds.reverse(), 50, 1, 50];

    expect(parseSectionsCalendarIds(calendarRequest(input.join(",")))).toEqual(
      Array.from(
        { length: MAX_MULTI_SECTION_CALENDAR_IDS },
        (_, index) => index + 1,
      ),
    );
  });

  it.each([undefined, "", " "])("rejects empty input %s", async (input) => {
    const response = parseSectionsCalendarIds(calendarRequest(input));

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });

  it.each([
    "1,foo,2",
    "1,,2",
    "0",
    "-1",
    "1.5",
    "9007199254740992",
  ])("rejects malformed input %s", async (input) => {
    const response = parseSectionsCalendarIds(calendarRequest(input));

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
    await expect((response as Response).json()).resolves.toEqual({
      error: "Invalid sectionIds parameter",
    });
  });

  it("canonicalizes equivalent ID sets to one URL", () => {
    const request = new Request(
      "https://life.example/api/catalog/sections/calendar.ics?sectionIds=3,1,3&ignored=1",
    );
    const sectionIds = parseSectionsCalendarIds(request);
    expect(sectionIds).toEqual([1, 3]);

    const canonicalUrl = canonicalSectionsCalendarUrl(
      request,
      sectionIds as number[],
    );
    expect(canonicalUrl?.href).toBe(
      "https://life.example/api/catalog/sections/calendar.ics?sectionIds=1%2C3",
    );
    expect(
      canonicalSectionsCalendarUrl(
        new Request(canonicalUrl as URL),
        sectionIds as number[],
      ),
    ).toBeNull();
  });
});
