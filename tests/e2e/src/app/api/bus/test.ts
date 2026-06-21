/**
 * E2E tests for bus schedule APIs
 *
 * ## GET /api/bus
 * Public raw shuttle-bus timetable dataset.
 * - Accepts: versionKey
 * - Returns: { version, availableVersions, campuses, routes, trips, preferences }
 * - Includes both weekday and weekend trips without server-side filtering/ranking
 * - Returns 404 when no schedule data exists for the requested version
 *
 * ## GET /api/bus/routes
 * Public filtered route discovery.
 *
 * ## GET /api/bus/next
 * Public ranked next departures for one origin/destination pair.
 *
 * ## GET/POST /api/bus/preferences
 * Authenticated endpoint for user bus planner defaults.
 * - GET: returns current preference or default values
 * - POST: saves preferred origin/destination plus departed-trip toggle
 * - 401 for unauthenticated, 400 for invalid body
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

const BASE = "/api/bus";
const PREF_BASE = "/api/bus/preferences";
const ROUTES_BASE = "/api/bus/routes";
const NEXT_BASE = "/api/bus/next";
const SEED_VERSION = `versionKey=${DEV_SEED.bus.versionKey}`;

type BusResponse = {
  version?: { key?: string; title?: string | null };
  availableVersions?: Array<{ key?: string }>;
  routes?: Array<{
    id?: number;
    stops?: Array<{ campus?: { id?: number; namePrimary?: string } }>;
  }>;
  trips?: Array<{
    routeId?: number;
    dayType?: string;
    departureTime?: string | null;
  }>;
  preferences?: {
    preferredOriginCampusId?: number | null;
    preferredDestinationCampusId?: number | null;
    showDepartedTrips?: boolean;
  } | null;
};

type PreferenceResponse = {
  preference?: {
    preferredOriginCampusId?: number | null;
    preferredDestinationCampusId?: number | null;
    showDepartedTrips?: boolean;
  };
};

type BusRouteSearchResponse = {
  originCampus?: { id?: number; namePrimary?: string } | null;
  destinationCampus?: { id?: number; namePrimary?: string } | null;
  total?: number;
  routes?: Array<{
    id?: number;
    stopCount?: number;
    weekdayTrips?: number;
    weekendTrips?: number;
    stops?: Array<{ campus?: { id?: number } }>;
  }>;
};

type BusNextResponse = {
  originCampus?: { id?: number } | null;
  destinationCampus?: { id?: number } | null;
  dayType?: string;
  totalRoutes?: number;
  departures?: Array<{
    routeId?: number;
    status?: string;
    minutesUntilDeparture?: number | null;
    departureTime?: string | null;
  }>;
};

async function saveBusPreference(
  request: import("@playwright/test").APIRequestContext,
  preference: PreferenceResponse["preference"],
) {
  const response = await request.post(PREF_BASE, { data: preference });
  expect(response.status()).toBe(200);
}

test.describe("GET /api/bus", () => {
  test("returns raw timetable data with both weekday and weekend trips", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}?${SEED_VERSION}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as BusResponse;

    expect(body.version?.key).toBe(DEV_SEED.bus.versionKey);
    expect(
      body.availableVersions?.some(
        (version) => version.key === DEV_SEED.bus.versionKey,
      ),
    ).toBe(true);
    const routeIds = body.routes?.map((route) => route.id).sort() ?? [];
    expect(routeIds).toEqual(expect.arrayContaining([1, 3, 7, 8]));

    const weekdayTrips =
      body.trips?.filter((trip) => trip.dayType === "weekday").length ?? 0;
    const weekendTrips =
      body.trips?.filter((trip) => trip.dayType === "weekend").length ?? 0;

    expect(weekdayTrips).toBeGreaterThan(0);
    expect(weekendTrips).toBeGreaterThan(0);
    expect(body.preferences).toBeNull();
  });

  test("authenticated callers receive their saved bus preferences", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");

    try {
      const saveResponse = await page.request.post(PREF_BASE, {
        data: {
          preferredOriginCampusId: 1,
          preferredDestinationCampusId: 4,
          showDepartedTrips: true,
        },
      });
      expect(saveResponse.status()).toBe(200);

      const response = await page.request.get(`${BASE}?${SEED_VERSION}`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as BusResponse;

      expect(body.preferences?.preferredOriginCampusId).toBe(1);
      expect(body.preferences?.preferredDestinationCampusId).toBe(4);
      expect(body.preferences?.showDepartedTrips).toBe(true);
    } finally {
      await page.request.post(PREF_BASE, {
        data: {
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: false,
        },
      });
    }
  });

  test("route 8 raw trip times match the seed timetable", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}?${SEED_VERSION}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as BusResponse;

    const route8WeekdayDepartures = (body.trips ?? [])
      .filter((trip) => trip.routeId === 8 && trip.dayType === "weekday")
      .map((trip) => trip.departureTime)
      .filter(Boolean)
      .sort();

    expect(route8WeekdayDepartures).toEqual(["06:50", "12:50", "21:20"]);
  });

  test("route topology matches the seed data", async ({ request }) => {
    const response = await request.get(`${BASE}?${SEED_VERSION}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as BusResponse;

    const route8StopIds = body.routes
      ?.find((route) => route.id === 8)
      ?.stops?.map((stop) => stop.campus?.id);
    expect(route8StopIds).toEqual([1, 2, 5, 6]);

    const route7StopIds = body.routes
      ?.find((route) => route.id === 7)
      ?.stops?.map((stop) => stop.campus?.id);
    expect(route7StopIds).toEqual([6, 5, 2, 1]);
  });

  test("unknown versionKey returns 404", async ({ request }) => {
    const response = await request.get(
      `${BASE}?versionKey=missing-bus-version`,
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("GET /api/bus/routes", () => {
  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: ROUTES_BASE });
  });

  test("returns concrete route variants for an origin/destination", async ({
    request,
  }) => {
    const response = await request.get(
      `${ROUTES_BASE}?originCampusId=${DEV_SEED.bus.originCampusId}&destinationCampusId=${DEV_SEED.bus.destinationCampusId}&${SEED_VERSION}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as BusRouteSearchResponse;

    expect(body.originCampus?.id).toBe(DEV_SEED.bus.originCampusId);
    expect(body.destinationCampus?.id).toBe(DEV_SEED.bus.destinationCampusId);
    expect((body.total ?? 0) > 0).toBe(true);

    const seedRoute = body.routes?.find(
      (route) => route.id === DEV_SEED.bus.routeId,
    );
    expect(seedRoute).toBeDefined();
    expect(seedRoute?.stopCount).toBeGreaterThan(1);
    expect(seedRoute?.weekdayTrips).toBeGreaterThan(0);
    expect(seedRoute?.stops?.[0]?.campus?.id).toBe(DEV_SEED.bus.originCampusId);
  });
});

test.describe("GET /api/bus/next", () => {
  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: NEXT_BASE });
  });

  test("returns ranked next departures with status metadata", async ({
    request,
  }) => {
    const response = await request.get(
      `${NEXT_BASE}?originCampusId=${DEV_SEED.bus.originCampusId}&destinationCampusId=${DEV_SEED.bus.destinationCampusId}&atTime=${encodeURIComponent(DEV_SEED_ANCHOR.recommendedAtTime)}&dayType=weekday&includeDeparted=true&limit=1&${SEED_VERSION}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as BusNextResponse;

    expect(body.originCampus?.id).toBe(DEV_SEED.bus.originCampusId);
    expect(body.destinationCampus?.id).toBe(DEV_SEED.bus.destinationCampusId);
    expect(body.dayType).toBe("weekday");
    expect((body.totalRoutes ?? 0) > 0).toBe(true);
    expect(body.departures).toHaveLength(1);
    expect(body.departures?.[0]?.status).toBe("upcoming");
    expect(body.departures?.[0]?.departureTime).not.toBe(
      DEV_SEED.bus.recommendedDeparture,
    );
    expect(body.departures?.[0]?.minutesUntilDeparture).toBeGreaterThanOrEqual(
      0,
    );
  });

  test("missing required campus IDs returns 400", async ({ request }) => {
    const response = await request.get(NEXT_BASE);
    expect(response.status()).toBe(400);
  });
});

test.describe("/api/bus/preferences", () => {
  test.describe.configure({ mode: "serial" });

  test("GET without auth returns 401", async ({ request }) => {
    const response = await request.get(PREF_BASE);
    expect(response.status()).toBe(401);
  });

  test("POST without auth returns 401", async ({ request }) => {
    const response = await request.post(PREF_BASE, {
      data: {
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 2,
        showDepartedTrips: false,
      },
    });
    expect(response.status()).toBe(401);
  });

  test("authenticated GET returns the saved planner defaults", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");
    const originalResponse = await page.request.get(PREF_BASE);
    expect(originalResponse.status()).toBe(200);
    const original = ((await originalResponse.json()) as PreferenceResponse)
      .preference;

    try {
      await saveBusPreference(page.request, {
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      });

      const response = await page.request.get(PREF_BASE);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as PreferenceResponse;

      expect(body.preference?.preferredOriginCampusId).toBeNull();
      expect(body.preference?.preferredDestinationCampusId).toBeNull();
      expect(body.preference?.showDepartedTrips).toBe(false);
    } finally {
      await saveBusPreference(page.request, {
        preferredOriginCampusId: original?.preferredOriginCampusId ?? null,
        preferredDestinationCampusId:
          original?.preferredDestinationCampusId ?? null,
        showDepartedTrips: original?.showDepartedTrips ?? false,
      });
    }
  });

  test("POST saves planner defaults and GET reads them back", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");
    const originalResponse = await page.request.get(PREF_BASE);
    expect(originalResponse.status()).toBe(200);
    const original = ((await originalResponse.json()) as PreferenceResponse)
      .preference;

    try {
      const saveResponse = await page.request.post(PREF_BASE, {
        data: {
          preferredOriginCampusId: 1,
          preferredDestinationCampusId: 4,
          showDepartedTrips: true,
        },
      });
      expect(saveResponse.status()).toBe(200);
      const saveBody = (await saveResponse.json()) as PreferenceResponse;
      expect(saveBody.preference?.preferredOriginCampusId).toBe(1);
      expect(saveBody.preference?.preferredDestinationCampusId).toBe(4);
      expect(saveBody.preference?.showDepartedTrips).toBe(true);

      const getResponse = await page.request.get(PREF_BASE);
      expect(getResponse.status()).toBe(200);
      const getBody = (await getResponse.json()) as PreferenceResponse;
      expect(getBody.preference?.preferredOriginCampusId).toBe(1);
      expect(getBody.preference?.preferredDestinationCampusId).toBe(4);
      expect(getBody.preference?.showDepartedTrips).toBe(true);
    } finally {
      await saveBusPreference(page.request, {
        preferredOriginCampusId: original?.preferredOriginCampusId ?? null,
        preferredDestinationCampusId:
          original?.preferredDestinationCampusId ?? null,
        showDepartedTrips: original?.showDepartedTrips ?? false,
      });
    }
  });

  test("POST with invalid body returns 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(PREF_BASE, {
      data: {
        preferredOriginCampusId: "not-a-number",
        showDepartedTrips: "not-a-boolean",
      },
    });
    expect(response.status()).toBe(400);
  });
});
