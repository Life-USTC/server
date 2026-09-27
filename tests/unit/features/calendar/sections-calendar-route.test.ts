import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateSectionsCalendarActionMock } = vi.hoisted(() => ({
  generateSectionsCalendarActionMock: vi.fn(),
}));

vi.mock("@/lib/api/routes/calendar-route-actions", () => ({
  generateSectionCalendarAction: vi.fn(),
  generateSectionsCalendarAction: generateSectionsCalendarActionMock,
  generateUserCalendarAction: vi.fn(),
}));

describe("multi-section calendar route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ical.multi-section-canonical-set", async () => {
    const { getSectionsCalendarRoute } = await import(
      "@/lib/api/routes/calendars"
    );
    const response = await getSectionsCalendarRoute(
      new Request(
        "https://life.example/api/catalog/sections/calendar.ics?sectionIds=3,1,3",
      ),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(
      "https://life.example/api/catalog/sections/calendar.ics?sectionIds=1%2C3",
    );
    expect(generateSectionsCalendarActionMock).not.toHaveBeenCalled();
  });

  it("loads only a canonical bounded ID list", async () => {
    const calendarResponse = new Response("BEGIN:VCALENDAR", { status: 200 });
    generateSectionsCalendarActionMock.mockResolvedValue(calendarResponse);
    const { getSectionsCalendarRoute } = await import(
      "@/lib/api/routes/calendars"
    );
    const response = await getSectionsCalendarRoute(
      new Request(
        "https://life.example/api/catalog/sections/calendar.ics?sectionIds=1%2C3",
      ),
    );

    expect(response).toBe(calendarResponse);
    expect(generateSectionsCalendarActionMock).toHaveBeenCalledWith([1, 3]);
  });
});

it("ical.bounded-multi-section-export", async () => {
  const { getSectionsCalendarRoute } = await import(
    "@/lib/api/routes/calendars"
  );
  const ids = Array.from({ length: 50 }, (_, index) => index + 1);
  generateSectionsCalendarActionMock
    .mockReset()
    .mockImplementation(async () => new Response("BEGIN:VCALENDAR"));
  const valid = await getSectionsCalendarRoute(
    new Request(
      `https://life.example/api/catalog/sections/calendar.ics?sectionIds=${encodeURIComponent(ids.join(","))}`,
    ),
  );
  expect(valid.status).toBe(200);
  expect(generateSectionsCalendarActionMock).toHaveBeenCalledExactlyOnceWith(
    ids,
  );
  generateSectionsCalendarActionMock.mockClear();
  for (const input of [
    "",
    "0",
    "-1",
    "1.5",
    "x",
    "1,,2",
    "1x",
    "9007199254740992",
    [...ids, 51].join(","),
  ]) {
    const response = await getSectionsCalendarRoute(
      new Request(
        `https://life.example/api/catalog/sections/calendar.ics?sectionIds=${encodeURIComponent(input)}`,
      ),
    );
    expect(response.status).toBe(400);
  }
  expect(generateSectionsCalendarActionMock).not.toHaveBeenCalled();
});
