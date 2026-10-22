import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/i18n/config";

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

  it("bus.public-route-search-url-determined", async () => {
    searchBusRoutesMock.mockResolvedValue({
      originCampus: campus,
      destinationCampus: null,
      total: 0,
      routes: [],
    });
    const { getBusRoutesSearchRoute } = await import("@/lib/api/routes/bus");

    const url = "https://life.example/api/catalog/bus/routes";
    const bodies: string[] = [];
    const headerCases: Record<string, string>[] = [
      {},
      { cookie: `${LOCALE_COOKIE}=en-us` },
      { "accept-language": "en-US,en;q=0.9" },
      { cookie: `${LOCALE_COOKIE}=en-us`, "accept-language": "en-US,en;q=0.9" },
    ];
    for (const headers of headerCases) {
      const response = await getBusRoutesSearchRoute(
        new Request(url, { headers }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
      );
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "public, max-age=3600, stale-while-revalidate=300",
      );
      expect(response.headers.get("Cache-Tag")).toBe("catalog");
      // Cloudflare stores a response only when its `Vary` is absent or
      // `Accept-Encoding`; any other value discards every copy, so a declared
      // shared TTL must come with none.
      expect(response.headers.get("Vary")).toBeNull();
      bodies.push(await response.text());
    }

    expect(new Set(bodies).size).toBe(1);
    for (const call of searchBusRoutesMock.mock.calls) {
      expect(call[0].locale).toBe(DEFAULT_LOCALE);
    }

    // The query parameter stays the only locale the route reads.
    const explicit = await getBusRoutesSearchRoute(
      new Request(`${url}?locale=en-us`, {
        headers: { cookie: `${LOCALE_COOKIE}=zh-cn` },
      }),
    );
    expect(await explicit.text()).toBe(bodies[0]);
    expect(searchBusRoutesMock.mock.calls.at(-1)?.[0].locale).toBe("en-us");
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
