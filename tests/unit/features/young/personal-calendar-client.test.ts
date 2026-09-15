import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersonalCalendar,
  type PersonalCalendarItem,
  personalItemsForDay,
} from "@/features/young/lib/personal-calendar-client";

const item: PersonalCalendarItem = {
  id: "young-1",
  type: "young_event",
  youngId: "1",
  title: "Night workshop",
  at: "2026-09-15T23:00:00+08:00",
  endsAt: "2026-09-16T01:00:00+08:00",
  location: "Lab",
  url: "/catalog/young-events/1",
};
afterEach(() => vi.unstubAllGlobals());
describe("personal calendar client", () => {
  it("places an overnight activity on both Shanghai dates, excluding its end boundary", () => {
    expect(personalItemsForDay([item], "2026-09-15")).toHaveLength(1);
    expect(personalItemsForDay([item], "2026-09-16")).toHaveLength(1);
    expect(personalItemsForDay([item], "2026-09-17")).toHaveLength(0);
    expect(
      personalItemsForDay(
        [{ ...item, endsAt: "2026-09-16T00:00:00+08:00" }],
        "2026-09-16",
      ),
    ).toHaveLength(0);
    expect(
      personalItemsForDay([{ ...item, at: null, endsAt: null }], "2026-09-15"),
    ).toHaveLength(0);
  });
  it("loads every page before displaying a calendar range", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [item],
          pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [{ ...item, id: "young-2" }],
          pagination: { page: 2, pageSize: 1, total: 2, totalPages: 2 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchPersonalCalendar(
      "2026-09-15",
      "2026-09-30",
      new AbortController().signal,
    );
    expect(result.map((value) => value.id)).toEqual(["young-1", "young-2"]);
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });
  it("fails visibly instead of treating a failed page as an empty calendar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("error", { status: 503 })),
    );
    await expect(
      fetchPersonalCalendar(
        "2026-09-15",
        "2026-09-30",
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });
});
