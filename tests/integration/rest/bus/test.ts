import { expect } from "@playwright/test";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../e2e/utils/dev-seed";
import { createFixturePrisma } from "../../../shared/prisma";
import { test } from "../_harness/actor";

const BASE = "/api/catalog/bus";
const PREF_BASE = "/api/workspace/bus-preferences";
const ROUTES_BASE = "/api/catalog/bus/routes";
const NEXT_BASE = "/api/catalog/bus/next";
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

type BusRouteSearchResponse = {
  originCampus?: { id?: number; namePrimary?: string } | null;
  destinationCampus?: { id?: number; namePrimary?: string } | null;
  total?: number;
  routes?: Array<{
    id?: number;
    stopCount?: number;
    weekdayTrips?: number;
    saturdayTrips?: number;
    sundayTrips?: number;
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

test.describe("GET /api/catalog/bus 校车时刻表", () => {
  test("known timetable exposes versions, day types, departure times and route topology", async ({
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
    const sundayTrips =
      body.trips?.filter((trip) => trip.dayType === "sunday").length ?? 0;

    expect(weekdayTrips).toBeGreaterThan(0);
    expect(sundayTrips).toBeGreaterThan(0);
    expect(body.preferences).toBeNull();

    const route8WeekdayDepartures = (body.trips ?? [])
      .filter((trip) => trip.routeId === 8 && trip.dayType === "weekday")
      .map((trip) => trip.departureTime)
      .filter(Boolean)
      .sort();

    expect(route8WeekdayDepartures).toEqual(["06:50", "12:50", "21:20"]);

    const route8StopIds = body.routes
      ?.find((route) => route.id === 8)
      ?.stops?.map((stop) => stop.campus?.id);
    expect(route8StopIds).toEqual([1, 2, 5, 6]);

    const route7StopIds = body.routes
      ?.find((route) => route.id === 7)
      ?.stops?.map((stop) => stop.campus?.id);
    expect(route7StopIds).toEqual([6, 5, 2, 1]);
  });

  test("未知 versionKey 返回 404", async ({ request }) => {
    const response = await request.get(
      `${BASE}?versionKey=missing-bus-version`,
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("GET /api/catalog/bus/routes 路线发现", () => {
  test("返回起点到终点的具体路线变体", async ({ request }) => {
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
    expect(seedRoute?.saturdayTrips).toBeGreaterThanOrEqual(0);
    expect(seedRoute?.sundayTrips).toBeGreaterThanOrEqual(0);
    expect(seedRoute?.stops?.[0]?.campus?.id).toBe(DEV_SEED.bus.originCampusId);
  });
});

test.describe("GET /api/catalog/bus/next 下一班车", () => {
  test("返回带状态元数据的排序下一班车", async ({ request }) => {
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

  test("缺少必需的校区 ID 返回 400", async ({ request }) => {
    const response = await request.get(NEXT_BASE);
    expect(response.status()).toBe(400);
  });
});

test("known bus preferences personalize the catalog independently of writes", async ({
  createActor,
}) => {
  const owner = await createActor();
  const db = createFixturePrisma();
  const preference = {
    preferredOriginCampusId: 1,
    preferredDestinationCampusId: 4,
    showDepartedTrips: true,
  };
  try {
    await db.busUserPreference.create({
      data: { userId: owner.id, ...preference },
    });
    const response = await owner.request.get(`${BASE}?${SEED_VERSION}`);
    expect(response.status()).toBe(200);
    expect((await response.json()).preferences).toMatchObject(preference);
  } finally {
    await db.$disconnect();
  }
});

test.describe("/api/workspace/bus-preferences", () => {
  for (const method of ["get", "post"] as const) {
    test(`anonymous ${method} returns JSON 401`, async ({ request }) => {
      const response = await request[method](
        PREF_BASE,
        method === "post"
          ? {
              data: {
                preferredOriginCampusId: 1,
                preferredDestinationCampusId: 2,
                showDepartedTrips: false,
              },
            }
          : {},
      );
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toEqual(expect.any(String));
    });
  }

  test("a new user receives empty defaults", async ({ createActor }) => {
    const owner = await createActor();
    const response = await owner.request.get(PREF_BASE);
    expect(response.status()).toBe(200);
    expect((await response.json()).preference).toMatchObject({
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });
  });

  for (const clear of [false, true]) {
    test(`POST ${clear ? "clears" : "saves"} preferences without changing another user`, async ({
      createActor,
    }) => {
      const owner = await createActor();
      const other = await createActor();
      const db = createFixturePrisma();
      const initial = {
        preferredOriginCampusId: 2,
        preferredDestinationCampusId: 1,
        showDepartedTrips: false,
      };
      const expected = clear
        ? {
            preferredOriginCampusId: null,
            preferredDestinationCampusId: null,
            showDepartedTrips: false,
          }
        : {
            preferredOriginCampusId: 1,
            preferredDestinationCampusId: 4,
            showDepartedTrips: true,
          };
      try {
        await db.busUserPreference.createMany({
          data: [owner, other].map(({ id }) => ({ userId: id, ...initial })),
        });
        const otherBefore = await db.busUserPreference.findUniqueOrThrow({
          where: { userId: other.id },
        });
        const response = await owner.request.post(PREF_BASE, {
          data: expected,
        });
        expect(response.status()).toBe(200);
        expect((await response.json()).preference).toMatchObject(expected);
        expect(
          await db.busUserPreference.findUniqueOrThrow({
            where: { userId: owner.id },
          }),
        ).toMatchObject(expected);
        expect(
          await db.busUserPreference.findUniqueOrThrow({
            where: { userId: other.id },
          }),
        ).toEqual(otherBefore);
        const read = await owner.request.get(PREF_BASE);
        expect(read.status()).toBe(200);
        expect((await read.json()).preference).toMatchObject(expected);
      } finally {
        await db.$disconnect();
      }
    });
  }

  test("invalid preference body leaves known state unchanged", async ({
    createActor,
  }) => {
    const owner = await createActor();
    const db = createFixturePrisma();
    try {
      const before = await db.busUserPreference.create({
        data: { userId: owner.id, preferredOriginCampusId: 1 },
      });
      const response = await owner.request.post(PREF_BASE, {
        data: {
          preferredOriginCampusId: "not-a-number",
          showDepartedTrips: "not-a-boolean",
        },
      });
      expect(response.status()).toBe(400);
      expect(
        await db.busUserPreference.findUniqueOrThrow({
          where: { userId: owner.id },
        }),
      ).toEqual(before);
    } finally {
      await db.$disconnect();
    }
  });
});
