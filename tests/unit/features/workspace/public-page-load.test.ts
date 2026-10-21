import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBusTabDataMock,
  getNextDeparturesFromHubCampusMock,
  getPublicCatalogLinksDataMock,
  getWeatherSnapshotMock,
  listPublicationsMock,
  listYoungEventsMock,
  logAppEventMock,
  readWeatherCacheMock,
} = vi.hoisted(() => ({
  getBusTabDataMock: vi.fn(),
  getNextDeparturesFromHubCampusMock: vi.fn(),
  getPublicCatalogLinksDataMock: vi.fn(),
  getWeatherSnapshotMock: vi.fn(),
  listPublicationsMock: vi.fn(),
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
  () => ({ listPublications: listPublicationsMock }),
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
import { loadAnonymousHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import { loadPublicBusPage } from "@/features/workspace/server/public-bus-page-load";

const url = new URL("https://example.test/");
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
    listPublicationsMock.mockReset();
    listYoungEventsMock.mockReset();
    logAppEventMock.mockReset();
    readWeatherCacheMock.mockReset();

    readWeatherCacheMock.mockResolvedValue(null);
    getWeatherSnapshotMock.mockResolvedValue(null);
    getNextDeparturesFromHubCampusMock.mockResolvedValue(null);
    listPublicationsMock.mockResolvedValue({ data: [] });
    listYoungEventsMock.mockResolvedValue({ data: [] });
  });

  it("loads the public information sections for the anonymous home page", async () => {
    readWeatherCacheMock.mockResolvedValue({
      current: { condition: { text: "Clear" }, temperature: 18.4 },
    });
    getNextDeparturesFromHubCampusMock.mockResolvedValue({
      departures: [
        {
          departureTime: "18:40",
          destinationCampus: { id: 2, namePrimary: "West" },
          minutesUntilDeparture: 12,
          tripId: 7,
        },
      ],
      originCampus: { id: 1, namePrimary: "East" },
    });
    listPublicationsMock.mockResolvedValue({
      data: [
        {
          id: "pub-1",
          revision: { publishedAt: null, title: "Midterm schedule" },
          source: { name: "Academic Affairs" },
        },
      ],
    });
    listYoungEventsMock.mockResolvedValue({
      data: [
        {
          location: "Auditorium",
          name: "Quantum lecture",
          organizer: null,
          startAt: null,
          youngId: "young-1",
        },
      ],
    });

    const result = await loadAnonymousHomePage(event);

    expect(result).toMatchObject({ locale: "en-us", signedIn: false });
    expect(result.information.weather).toEqual([
      { condition: "Clear", locationKey: "ustc-main", temperature: "18°" },
      { condition: "Clear", locationKey: "ustc-gaoxin", temperature: "18°" },
    ]);
    expect(result.information.bus?.departures).toEqual([
      {
        departureTime: "18:40",
        destination: "West",
        key: "7-2",
        relativeLabel: "in 12 min",
      },
    ]);
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
    // The landing page reads its own lean sections, never the heavy
    // signed-in workspace tab payloads.
    expect(getBusTabDataMock).not.toHaveBeenCalled();
    expect(getPublicCatalogLinksDataMock).not.toHaveBeenCalled();
  });

  it("degrades one failing section without blanking the anonymous home page", async () => {
    readWeatherCacheMock.mockRejectedValue(new Error("weather upstream down"));
    getWeatherSnapshotMock.mockRejectedValue(
      new Error("weather upstream down"),
    );
    listPublicationsMock.mockResolvedValue({
      data: [
        {
          id: "pub-1",
          revision: { publishedAt: null, title: "Midterm schedule" },
          source: { name: "Academic Affairs" },
        },
      ],
    });

    const result = await loadAnonymousHomePage(event);

    expect(result.information.weather).toBeNull();
    expect(result.information.notices).toHaveLength(1);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "warn",
      "home.section.degraded",
      expect.objectContaining({ section: "weather" }),
    );
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
