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
  resolveApiUserId: vi.fn(),
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

  it("keeps anonymous raw timetable responses private", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue(null);
    getBusTimetableDataMock.mockResolvedValue(timetable);
    const { getBusRoute } = await import("@/lib/api/routes/bus");

    const response = await getBusRoute(
      new Request("https://life.example/api/catalog/bus"),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  });

  it("keeps an auth-signaled timetable response private", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue(null);
    getBusTimetableDataMock.mockResolvedValue(timetable);
    const { getBusRoute } = await import("@/lib/api/routes/bus");

    const response = await getBusRoute(
      new Request("https://life.example/api/catalog/bus", {
        headers: { cookie: "better-auth.session_token=session" },
      }),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
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

  it("never edge-caches time-sensitive next departures", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue(null);
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

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  });
});
