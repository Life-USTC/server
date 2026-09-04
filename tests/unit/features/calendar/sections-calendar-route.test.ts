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

  it("redirects equivalent ID sets before loading expanded calendar data", async () => {
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
