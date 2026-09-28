import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getBusTimetableDataMock,
  getNextBusDeparturesMock,
  searchBusRoutesMock,
} = vi.hoisted(() => ({
  getBusTimetableDataMock: vi.fn(),
  getNextBusDeparturesMock: vi.fn(),
  searchBusRoutesMock: vi.fn(),
}));

vi.mock("@/features/bus/server/bus-service", () => ({
  getBusTimetableData: getBusTimetableDataMock,
  getNextBusDepartures: getNextBusDeparturesMock,
  searchBusRoutes: searchBusRoutesMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveSessionUserId: vi.fn(),
}));

const campus = {
  id: 1,
  nameCn: "东区",
  nameEn: null,
  namePrimary: "东区",
  nameSecondary: null,
  latitude: 31.1,
  longitude: 117.1,
};

const timetable = {
  locale: "zh-cn" as const,
  fetchedAt: "2026-08-14T00:00:00.000Z",
  version: null,
  availableVersions: [],
  campuses: [campus],
  routes: [],
  trips: [],
  preferences: null,
  notice: null,
};

describe("bus REST cache boundaries", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("bus.cache-boundaries", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    const { getBusRoute } = await import("@/lib/api/routes/bus");
    for (const userId of [null, "owner-id"]) {
      vi.mocked(resolveSessionUserId).mockResolvedValue(userId);
      getBusTimetableDataMock.mockResolvedValue({
        ...timetable,
        preferences: userId
          ? {
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: null,
              showDepartedTrips: true,
            }
          : null,
      });
      const response = await getBusRoute(
        new Request("https://life.example/api/catalog/bus"),
      );
      expect(response.status).toBe(200);
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "no-store",
      );
    }
  });

  it("publicly edge-caches viewer-independent route search", async () => {
    searchBusRoutesMock.mockResolvedValue({
      originCampus: campus,
      destinationCampus: null,
      total: 0,
      routes: [],
    });
    const { getBusRoutesSearchRoute } = await import("@/lib/api/routes/bus");

    const response = await getBusRoutesSearchRoute(
      new Request("https://life.example/api/catalog/bus/routes"),
    );

    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=3600, stale-while-revalidate=300",
    );
    expect(response.headers.get("Cache-Tag")).toBe("catalog");
  });

  it("bus.next-departures-uncached", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveSessionUserId).mockResolvedValue(null);
    getNextBusDeparturesMock.mockResolvedValue({
      originCampus: campus,
      destinationCampus: null,
      atTime: "2026-08-14T00:00:00.000Z",
      dayType: "weekday",
      totalRoutes: 0,
      departures: [],
      nextAvailableDeparture: null,
      message: null,
    });
    const { getBusNextDeparturesRoute } = await import("@/lib/api/routes/bus");

    const response = await getBusNextDeparturesRoute(
      new Request(
        "https://life.example/api/catalog/bus/next?originCampusId=1&destinationCampusId=2",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  });
});
