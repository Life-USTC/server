import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBusTabDataMock,
  getNextDeparturesFromHubCampusMock,
  getPublicCatalogLinksDataMock,
  getWeatherSnapshotMock,
  listPublicationHeadlinesMock,
  listYoungEventsMock,
  logAppEventMock,
  readWeatherCacheMock,
} = vi.hoisted(() => ({
  getBusTabDataMock: vi.fn(),
  getNextDeparturesFromHubCampusMock: vi.fn(),
  getPublicCatalogLinksDataMock: vi.fn(),
  getWeatherSnapshotMock: vi.fn(),
  listPublicationHeadlinesMock: vi.fn(),
  listYoungEventsMock: vi.fn(),
  logAppEventMock: vi.fn(),
  readWeatherCacheMock: vi.fn(),
}));

vi.mock("@/features/bus/server/bus-service", () => ({
  getNextDeparturesFromHubCampus: getNextDeparturesFromHubCampusMock,
}));

vi.mock("@/features/weather/server/weather-cache", () => ({
  readWeatherCache: readWeatherCacheMock,
}));

vi.mock("@/features/weather/server/weather-service", () => ({
  getWeatherSnapshot: getWeatherSnapshotMock,
}));

vi.mock(
  "@/features/publications/server/publication-public-read-service",
  () => ({ listPublicationHeadlines: listPublicationHeadlinesMock }),
);

vi.mock("@/features/young/server/young-event-service", () => ({
  listYoungEvents: listYoungEventsMock,
}));

vi.mock("@/features/workspace/server/workspace-tab-data", () => ({
  getBusTabData: getBusTabDataMock,
}));

vi.mock("@/features/catalog-links/server/catalog-link-data", () => ({
  getPublicCatalogLinksData: getPublicCatalogLinksDataMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

import { loadPublicLinksPage } from "@/features/catalog-links/server/public-links-page-load";
import { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import {
  loadAnonymousHomeInformation,
  loadHomeCampusNow,
} from "@/features/workspace/server/anonymous-home-sections";
import { loadPublicBusPage } from "@/features/workspace/server/public-bus-page-load";
import { getAnonymousHomePageCopy } from "@/lib/shell/page-copy";

const url = new URL("https://example.test/");
const campusNowInput = {
  copy: getAnonymousHomePageCopy("en-us"),
  locale: "en-us" as const,
  requestId: "request-1",
};
const event = {
  locals: {
    locale: "en-us" as const,
    requestId: "request-1",
  },
  request: new Request(url),
  url,
};

describe("public page loaders", () => {
  beforeEach(() => {
    getBusTabDataMock.mockReset();
    getNextDeparturesFromHubCampusMock.mockReset();
    getPublicCatalogLinksDataMock.mockReset();
    getWeatherSnapshotMock.mockReset();
    listPublicationHeadlinesMock.mockReset();
    listYoungEventsMock.mockReset();
    logAppEventMock.mockReset();
    readWeatherCacheMock.mockReset();

    readWeatherCacheMock.mockResolvedValue(null);
    getWeatherSnapshotMock.mockResolvedValue(null);
    getNextDeparturesFromHubCampusMock.mockResolvedValue(null);
    listPublicationHeadlinesMock.mockResolvedValue([]);
    listYoungEventsMock.mockResolvedValue({ data: [] });
  });

  it("loads the editorial information sections for the home page", async () => {
    listPublicationHeadlinesMock.mockResolvedValue([
      {
        id: "pub-1",
        revision: { publishedAt: null, title: "Midterm schedule" },
        source: { name: "Academic Affairs" },
      },
    ]);
    listYoungEventsMock.mockImplementation(async ({ tableFilters }) => ({
      data: [
        {
          location: "Auditorium",
          name:
            tableFilters.startAtOp === "gte"
              ? "Quantum lecture"
              : "Weekly club",
          organizer: null,
          startAt:
            tableFilters.startAtOp === "gte"
              ? "2026-11-07T10:00:00+08:00"
              : "2026-08-19T10:38:00+08:00",
          endAt:
            tableFilters.startAtOp === "gte"
              ? "2026-11-07T12:00:00+08:00"
              : "2027-01-02T10:38:00+08:00",
          youngId: tableFilters.startAtOp === "gte" ? "young-1" : "young-2",
        },
      ],
    }));

    const result = await loadHomePage(event);

    expect(result).toMatchObject({ locale: "en-us" });
    // `/` is cached, so the clock-driven shuttle board and weather are not in
    // the server render at all; they are read separately by the client.
    expect(result.information).not.toHaveProperty("bus");
    expect(result.information).not.toHaveProperty("weather");
    expect(getNextDeparturesFromHubCampusMock).not.toHaveBeenCalled();
    expect(readWeatherCacheMock).not.toHaveBeenCalled();
    expect(result.information.notices).toEqual([
      {
        dateLabel: null,
        href: "/news/pub-1",
        key: "pub-1",
        meta: "Academic Affairs",
        title: "Midterm schedule",
      },
    ]);
    expect(result.information.activities?.[0]?.href).toBe(
      "/catalog/young-events/young-1",
    );
    expect(
      result.information.activities?.map(({ ongoing }) => ongoing),
    ).toEqual([false, true]);
    expect(result.information.activities?.[1]?.dateLabel).toContain(
      "2027-01-02",
    );
    expect(listYoungEventsMock).toHaveBeenCalledTimes(2);
    for (const [
      { dateFrom, pageSize, timeBasis, tableFilters },
    ] of listYoungEventsMock.mock.calls) {
      expect(pageSize).toBe(5);
      expect(timeBasis).toBe("activity");
      expect(tableFilters).toMatchObject({
        active: "true",
        timeBasis: "activity",
      });
      expect(dateFrom.toISOString()).toBe(
        new Date(`${tableFilters.startAt}T00:00:00+08:00`).toISOString(),
      );
    }
    // The landing page reads its own lean sections, never the heavy
    // signed-in workspace tab payloads.
    expect(getBusTabDataMock).not.toHaveBeenCalled();
    expect(getPublicCatalogLinksDataMock).not.toHaveBeenCalled();
  });

  it("carries today's range and the next hours when the snapshot has a forecast", async () => {
    // Frozen so "the next hours" is a fixed set rather than whatever the
    // suite's wall clock makes it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T04:30:00Z"));
    try {
      readWeatherCacheMock.mockResolvedValue({
        current: { condition: { text: "Clear" }, temperature: 18.4 },
        daily: [
          { date: "2026-04-28", temperatureHigh: 9, temperatureLow: 1 },
          { date: "2026-04-29", temperatureHigh: 23.4, temperatureLow: 11.6 },
        ],
        hourly: [
          { at: "2026-04-29T04:00:00Z", temperature: 17 },
          { at: "2026-04-29T05:00:00Z", temperature: 19.4 },
          { at: "2026-04-29T06:00:00Z", temperature: 21 },
          { at: "2026-04-29T07:00:00Z", temperature: 22 },
          { at: "2026-04-29T08:00:00Z", temperature: 20 },
        ],
      });

      const result = await loadHomeCampusNow(campusNowInput);

      // The day that matches the Shanghai date wins over the first entry, and
      // only hours still ahead of the request clock are shipped.
      expect(result.weather?.[0]).toEqual({
        condition: "Clear",
        hourly: [
          { key: "2026-04-29T05:00:00Z", label: "13:00", temperature: "19°" },
          { key: "2026-04-29T06:00:00Z", label: "14:00", temperature: "21°" },
          { key: "2026-04-29T07:00:00Z", label: "15:00", temperature: "22°" },
        ],
        locationKey: "ustc-main",
        rangeLabel: "Today 23° / 12°",
        temperature: "18°",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("degrades one failing section without blanking the home page", async () => {
    readWeatherCacheMock.mockRejectedValue(new Error("weather upstream down"));
    getWeatherSnapshotMock.mockRejectedValue(
      new Error("weather upstream down"),
    );
    listPublicationHeadlinesMock.mockResolvedValue([
      {
        id: "pub-1",
        revision: { publishedAt: null, title: "Midterm schedule" },
        source: { name: "Academic Affairs" },
      },
    ]);

    const campusNow = await loadHomeCampusNow(campusNowInput);
    const result = await loadHomePage(event);

    expect(campusNow.weather).toBeNull();
    expect(result.information.notices).toHaveLength(1);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "warn",
      "home.section.degraded",
      expect.objectContaining({ section: "weather" }),
    );
  });

  it("keeps the home notice summary independent of the full list count", async () => {
    listPublicationHeadlinesMock.mockResolvedValue([
      {
        id: "latest",
        source: { name: "Campus" },
        revision: { title: "Latest", publishedAt: null },
      },
    ]);
    const result = await loadAnonymousHomeInformation({
      locale: "en-us",
      requestId: "summary",
    });
    expect(result.notices?.map(({ key }) => key)).toEqual(["latest"]);
    expect(listPublicationHeadlinesMock).toHaveBeenCalledWith(5);
  });

  it("distinguishes a timed-out notice summary from an empty success", async () => {
    vi.useFakeTimers();
    try {
      listPublicationHeadlinesMock.mockImplementation(
        () => new Promise(() => {}),
      );
      const pending = loadAnonymousHomeInformation({
        locale: "en-us",
        requestId: "timeout",
      });
      await vi.advanceTimersByTimeAsync(1500);
      expect(await pending).toEqual({ activities: [], notices: null });
      expect(logAppEventMock).toHaveBeenCalledWith(
        "warn",
        "home.section.degraded",
        expect.objectContaining({
          section: "notices",
          reason: "home section exceeded its budget",
        }),
      );
      listPublicationHeadlinesMock.mockResolvedValue([]);
      expect(
        await loadAnonymousHomeInformation({
          locale: "en-us",
          requestId: "empty",
        }),
      ).toEqual({ activities: [], notices: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads only bus data for the public bus page", async () => {
    getBusTabDataMock.mockResolvedValue({ data: { routes: [] } });

    const result = await loadPublicBusPage(event);

    expect(result.bus).toEqual({ routes: [] });
    expect(getBusTabDataMock).toHaveBeenCalledWith(null, "en-us");
    expect(getPublicCatalogLinksDataMock).not.toHaveBeenCalled();
  });

  it("loads only public links for the public links page", async () => {
    getPublicCatalogLinksDataMock.mockReturnValue({
      catalogLinks: [{ slug: "jw" }],
    });

    const result = await loadPublicLinksPage(event);

    expect(result.links).toEqual([{ slug: "jw" }]);
    expect(getPublicCatalogLinksDataMock).toHaveBeenCalledWith("en-us");
    expect(getBusTabDataMock).not.toHaveBeenCalled();
  });
  it("does not personalize public bus or links SSR when a session is present", async () => {
    getBusTabDataMock.mockResolvedValue({
      data: { routes: [], preferences: null },
    });
    getPublicCatalogLinksDataMock.mockReturnValue({
      catalogLinks: [{ slug: "jw", isPinned: false, clickCount: 0 }],
    });
    const signedEvent = {
      ...event,
      locals: { ...event.locals, authUser: { id: "private-user" } },
    };
    const [anonymousBus, signedBus, anonymousLinks, signedLinks] =
      await Promise.all([
        loadPublicBusPage(event),
        loadPublicBusPage(signedEvent),
        loadPublicLinksPage(event),
        loadPublicLinksPage(signedEvent),
      ]);
    expect(signedBus).toEqual(anonymousBus);
    expect(signedLinks).toEqual(anonymousLinks);
    for (const [userId] of getBusTabDataMock.mock.calls)
      expect(userId).toBeNull();
  });
});
