import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listYoungEvents: vi.fn(),
  listYoungEventCategories: vi.fn(),
  listYoungOrganizers: vi.fn(),
  getYoungOrganizer: vi.fn(),
  getYoungEvent: vi.fn(),
  getYoungSourceFreshness: vi.fn(),
}));
const options = vi.hoisted(() => vi.fn());
vi.mock("@/features/young/server/young-event-service", () => service);
vi.mock("@/features/young/server/young-organizer-service", () => ({
  listYoungOrganizerOptions: options,
}));

import {
  loadYoungCalendarPage,
  loadYoungEventDetailPage,
  loadYoungEventsPage,
  loadYoungOrganizerDetailPage,
  loadYoungOrganizersPage,
} from "@/features/young/server/young-page-load";

const source = { status: "unknown", lastSyncedAt: null };
const page = (
  data: unknown[] = [],
  total = data.length,
  number = 1,
  size = 100,
) => ({
  data,
  pagination: {
    page: number,
    pageSize: size,
    total,
    totalPages: Math.max(1, Math.ceil(total / size)),
  },
  source,
  unknownDateCount: 7,
});
const event = (url: string) => ({
  locals: { locale: "en-us" as const },
  url: new URL(url, "https://example.test"),
  request: new Request(new URL(url, "https://example.test")),
});
beforeEach(() => {
  vi.resetAllMocks();
  service.listYoungEvents.mockResolvedValue(page());
  service.listYoungEventCategories.mockResolvedValue(["Workshop"]);
  service.getYoungSourceFreshness.mockResolvedValue(source);
  service.listYoungOrganizers.mockResolvedValue(page());
  service.getYoungOrganizer.mockResolvedValue(null);
  service.getYoungEvent.mockResolvedValue(null);
  options.mockResolvedValue([{ id: "club", name: "Club" }]);
});
describe("public Young page loaders", () => {
  it("keeps list filters and page in the query while loading organizer identities only", async () => {
    const result = await loadYoungEventsPage(
      event(
        "/catalog/young-events?page=2&dateUnknown=true&timeBasis=registration&active=false&organizerId=club&search=run&category=sport",
      ),
    );
    expect(service.listYoungEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        dateUnknown: true,
        timeBasis: "registration",
        active: false,
        organizerId: "club",
        search: "run",
        category: "sport",
      }),
    );
    expect(result.organizers).toEqual([{ id: "club", name: "Club" }]);
    expect(service.listYoungOrganizers).not.toHaveBeenCalled();
  });
  it("loads every calendar page and retains unknown-date counts separately", async () => {
    service.listYoungEvents
      .mockResolvedValueOnce(page([{ youngId: "first" }], 201, 1))
      .mockResolvedValueOnce(page([{ youngId: "second" }], 201, 2))
      .mockResolvedValueOnce(page([{ youngId: "last" }], 201, 3));
    const result = await loadYoungCalendarPage(
      event(
        "/catalog/young-events/calendar?view=week&date=2035-09-15&timeBasis=registration&organizerId=club",
      ),
    );
    expect(result.data).toEqual([
      { youngId: "first" },
      { youngId: "second" },
      { youngId: "last" },
    ]);
    expect(result.range).toEqual({ start: "2035-09-10", end: "2035-09-16" });
    expect(result.unknownDateCount).toBe(7);
    expect(service.listYoungEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 3,
        pageSize: 100,
        dateFrom: "2035-09-10",
        dateTo: "2035-09-16",
        timeBasis: "registration",
        organizerId: "club",
      }),
    );
  });
  it("rejects a failed later page rather than displaying an incomplete calendar", async () => {
    service.listYoungEvents
      .mockResolvedValueOnce(page([], 101))
      .mockRejectedValueOnce(new Error("database unavailable"));
    await expect(
      loadYoungCalendarPage(
        event("/catalog/young-events/calendar?view=day&date=2035-09-15"),
      ),
    ).rejects.toThrow("database unavailable");
  });
  it("defaults invalid view and date values to a usable month", async () => {
    const result = await loadYoungCalendarPage(
      event(
        "/catalog/young-events/calendar?view=no&date=invalid&active=true&timeBasis=no",
      ),
    );
    expect(result.view).toBe("month");
    expect(result.filters).toMatchObject({
      active: true,
      timeBasis: "activity",
    });
    expect(result.anchorDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("paginates organizer search and activity histories", async () => {
    await loadYoungOrganizersPage(
      event("/catalog/young-events/organizers?search=Club&page=3"),
    );
    expect(service.listYoungOrganizers).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Club", page: 3 }),
    );
    await loadYoungOrganizerDetailPage({
      ...event("/catalog/young-events/organizers/club?page=4"),
      organizerId: "club",
    });
    expect(service.getYoungOrganizer).toHaveBeenCalledWith("club");
    expect(service.listYoungEvents).toHaveBeenCalledWith(
      expect.objectContaining({ organizerId: "club", page: 4 }),
    );
  });
  it("never embeds private comment state in public detail SSR", async () => {
    service.getYoungEvent.mockResolvedValue({ youngId: "42" });
    const result = await loadYoungEventDetailPage({
      ...event("/catalog/young-events/42"),
      youngId: "42",
    });
    expect(result.event).toEqual({ youngId: "42" });
    expect(result.commentsData).toBeNull();
    expect(result.source).toEqual(source);
  });
});
