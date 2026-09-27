import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import type { BusTimetableData } from "@/features/bus/lib/bus-types";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../api/mcp/helpers";

async function createFixture() {
  const marker = crypto.randomUUID().replaceAll("-", "");
  return withE2ePrisma(async (db) => {
    const campuses = await db.busCampus.findMany({
      take: 3,
      orderBy: { id: "asc" },
    });
    expect(campuses).toHaveLength(3);
    const rawCampuses = campuses.map(
      ({ id, nameCn: name, latitude, longitude }) => ({
        id,
        name,
        latitude,
        longitude,
      }),
    );
    const firstRouteId =
      1_600_000_000 + Math.floor(Math.random() * 100_000_000);
    const routes = [
      { id: firstRouteId, campuses: [rawCampuses[0], rawCampuses[1]] },
      { id: firstRouteId + 1, campuses: [rawCampuses[1], rawCampuses[2]] },
    ];
    for (const route of routes)
      await db.busRoute.create({
        data: {
          id: route.id,
          nameCn: `审计线路${route.id}`,
          stops: {
            create: route.campuses.map((campus, stopOrder) => ({
              campusId: campus.id,
              stopOrder: stopOrder + 1,
            })),
          },
        },
      });
    const raw = {
      campuses: rawCampuses,
      routes,
      weekday_routes: routes.map((route, index) => ({
        id: route.id,
        route,
        time: index
          ? [["09:00", "09:20"]]
          : [
              ["08:00", "08:20"],
              ["20:00", "20:20"],
            ],
      })),
      saturday_routes: [
        { id: routes[1].id, route: routes[1], time: [["10:00", "10:20"]] },
      ],
      sunday_routes: [],
    };
    const version = await db.busScheduleVersion.create({
      data: {
        key: `A.${marker}_-`.padEnd(120, "x"),
        title: `Audit ${marker}`,
        checksum: marker,
        rawJson: raw,
        isEnabled: false,
        effectiveFrom: new Date("2000-01-01T00:00:00Z"),
        effectiveUntil: new Date("2000-01-02T00:00:00Z"),
      },
    });
    for (const [dayType, schedules] of [
      ["weekday", raw.weekday_routes],
      ["saturday", raw.saturday_routes],
    ] as const)
      for (const schedule of schedules)
        for (const [position, stopTimes] of schedule.time.entries())
          await db.busTrip.create({
            data: {
              versionId: version.id,
              routeId: schedule.id,
              dayType,
              position,
              stopTimes,
            },
          });
    const users = [];
    for (const index of [0, 1]) {
      const name = `bus-contract-${marker}-${index}`;
      users.push(
        await db.user.create({
          data: {
            name,
            username: name,
            email: `${name}@example.test`,
            emailVerified: true,
            busPreference: {
              create: {
                preferredOriginCampusId: campuses[index].id,
                preferredDestinationCampusId: campuses[index + 1].id,
                showDepartedTrips: index === 0,
              },
            },
          },
        }),
      );
    }
    return { campuses, routes, version, users, raw };
  });
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;
async function withFixture(
  page: Page,
  request: APIRequestContext,
  run: (fixture: Fixture, client: Client) => Promise<void>,
) {
  const fixture = await createFixture();
  const client = new Client({ name: "bus-data-contract", version: "1" });
  let clientId: string | undefined;
  try {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.users[0].id)]);
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    const token = await issueAccessToken(page, request, {
      scope: "workspace.bus-preferences:read",
      clientScopes: ["workspace.bus-preferences:read"],
      resource,
    });
    clientId = token.clientId;
    await client.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        requestInit: {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        },
      }),
    );
    await run(fixture, client);
  } finally {
    await client.close();
    await withE2ePrisma(async (db) => {
      if (clientId) await db.oAuthClient.delete({ where: { clientId } });
      await db.user.deleteMany({
        where: { id: { in: fixture.users.map(({ id }) => id) } },
      });
      await db.busScheduleVersion.delete({ where: { id: fixture.version.id } });
      await db.busRoute.deleteMany({
        where: { id: { in: fixture.routes.map(({ id }) => id) } },
      });
    });
  }
}
async function call<Result>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Result> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError, `${name}: ${JSON.stringify(result)}`).not.toBe(true);
  return parseTextContent(result) as Result;
}
const timetableUrl = (versionKey: string) =>
  `/api/catalog/bus?versionKey=${encodeURIComponent(versionKey)}&locale=en-us`;

test("bus.raw-data-returned", async ({ page, request }) => {
  await withFixture(page, request, async (fixture, client) => {
    const response = await request.get(timetableUrl(fixture.version.key));
    expect(response.status()).toBe(200);
    const anonymous = (await response.json()) as BusTimetableData;
    expect(anonymous.preferences).toBeNull();
    expect(anonymous.routes.map(({ id }) => id)).toEqual(
      fixture.routes.map(({ id }) => id),
    );
    expect(
      anonymous.routes.map(({ stops }) => stops.map(({ campus }) => campus.id)),
    ).toEqual(
      fixture.routes.map(({ campuses }) => campuses.map(({ id }) => id)),
    );
    expect(
      anonymous.trips.map(({ dayType, routeId, stopTimes }) => ({
        dayType,
        routeId,
        times: stopTimes.map(({ time }) => time),
      })),
    ).toEqual([
      {
        dayType: "weekday",
        routeId: fixture.routes[0].id,
        times: ["08:00", "08:20"],
      },
      {
        dayType: "weekday",
        routeId: fixture.routes[0].id,
        times: ["20:00", "20:20"],
      },
      {
        dayType: "weekday",
        routeId: fixture.routes[1].id,
        times: ["09:00", "09:20"],
      },
      {
        dayType: "saturday",
        routeId: fixture.routes[1].id,
        times: ["10:00", "10:20"],
      },
    ]);
    const full = await call<BusTimetableData>(
      client,
      "catalog_bus_timetable_get",
      { versionKey: fixture.version.key, locale: "en-us", mode: "full" },
    );
    expect(full.routes).toEqual(anonymous.routes);
    expect(full.trips).toEqual(anonymous.trips);
    expect(full.campuses).toEqual(anonymous.campuses);
    for (const route of fixture.routes) {
      for (const pageNumber of [1, 2, 3]) {
        const response = await page.request.post("/api/graphql", {
          headers: { Origin: PLAYWRIGHT_BASE_URL },
          data: {
            query: `query($route:Int!,$version:String!,$page:PageInput!){catalog{busTimetable(routeId:$route,versionKey:$version,page:$page){route{id stops{campusId}} weekday{position stopTimes{time}} saturday{position stopTimes{time}} sunday{position stopTimes{time}} weekdayPageInfo{page pageSize total totalPages} saturdayPageInfo{page pageSize total totalPages} sundayPageInfo{page pageSize total totalPages}}}}`,
            variables: {
              route: route.id,
              version: fixture.version.key,
              page: { page: pageNumber, pageSize: 1 },
            },
          },
        });
        expect(response.status()).toBe(200);
        const graph = await response.json();
        expect(graph.errors).toBeUndefined();
        const timetable = graph.data.catalog.busTimetable;
        expect(timetable.route.id).toBe(route.id);
        expect(
          timetable.route.stops.map(
            (stop: { campusId: number }) => stop.campusId,
          ),
        ).toEqual(route.campuses.map((campus) => campus.id));
        for (const day of ["weekday", "saturday", "sunday"] as const) {
          const trips = anonymous.trips.filter(
            (trip) => trip.routeId === route.id && trip.dayType === day,
          );
          expect(timetable[`${day}PageInfo`]).toEqual({
            page: pageNumber,
            pageSize: 1,
            total: trips.length,
            totalPages: Math.max(1, trips.length),
          });
          expect(
            timetable[day].map(
              (trip: {
                position: number;
                stopTimes: { time: string | null }[];
              }) => ({
                position: trip.position,
                times: trip.stopTimes.map((stop) => stop.time),
              }),
            ),
          ).toEqual(
            trips.slice(pageNumber - 1, pageNumber).map((trip) => ({
              position: trip.position,
              times: trip.stopTimes.map((stop) => stop.time),
            })),
          );
        }
      }
    }
    for (const index of [0, 1]) {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([await createSignedSessionCookie(fixture.users[index].id)]);
      const response = await page.request.get(
        timetableUrl(fixture.version.key),
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as BusTimetableData;
      expect(body.preferences).toMatchObject({
        preferredOriginCampusId: fixture.campuses[index].id,
        preferredDestinationCampusId: fixture.campuses[index + 1].id,
        showDepartedTrips: index === 0,
      });
      expect(body.routes).toEqual(anonymous.routes);
      expect(body.trips).toEqual(anonymous.trips);
    }
  });
});

test("bus.version-key-boundary", async ({ page, request }) => {
  await withFixture(page, request, async (fixture, client) => {
    const graph = (versionKey: string) =>
      page.request.post("/api/graphql", {
        headers: { Origin: PLAYWRIGHT_BASE_URL },
        data: {
          query:
            "query($routeId:Int!,$key:String){catalog{busTimetable(routeId:$routeId,versionKey:$key){route{id} weekday{position}}}}",
          variables: { routeId: fixture.routes[0].id, key: versionKey },
        },
      });
    for (const versionKey of [
      fixture.version.key,
      ` \t${fixture.version.key}\n `,
    ]) {
      expect((await request.get(timetableUrl(versionKey))).status()).toBe(200);
      const gql = await graph(versionKey);
      expect(gql.status()).toBe(200);
      expect(await gql.json()).toMatchObject({
        data: {
          catalog: { busTimetable: { route: { id: fixture.routes[0].id } } },
        },
      });
      expect(
        (
          await call<BusTimetableData>(client, "catalog_bus_timetable_get", {
            versionKey,
            mode: "full",
          })
        ).version?.key,
      ).toBe(fixture.version.key);
    }
    for (const versionKey of [
      "",
      " \t\n ",
      "_bad",
      "-bad",
      ".bad",
      "a/b",
      "a b",
      "校车",
      "x".repeat(121),
    ]) {
      expect((await request.get(timetableUrl(versionKey))).status()).toBe(400);
      const gql = await graph(versionKey);
      const body = await gql.json();
      expect(body.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
      const mcp = await client.callTool({
        name: "catalog_bus_timetable_get",
        arguments: { versionKey },
      });
      expect(mcp.isError).toBe(true);
    }
  });
});

test("bus.current-version-only", async ({ page, request }) => {
  await withFixture(page, request, async (fixture, client) => {
    const response = await request.get("/api/catalog/bus?locale=en-us");
    expect(response.status()).toBe(200);
    const current = (await response.json()) as BusTimetableData;
    expect(current.routes.length).toBeGreaterThan(0);
    const listed = await call<{ routes: { id: number }[] }>(
      client,
      "catalog_bus_route_list",
      { locale: "en-us" },
    );
    expect(listed.routes.map(({ id }) => id)).toEqual(
      current.routes.map(({ id }) => id),
    );
    for (const route of fixture.routes)
      expect(listed.routes.map(({ id }) => id)).not.toContain(route.id);
    const collected: number[] = [];
    const totalPages = Math.max(1, Math.ceil(current.routes.length / 2));
    for (let pageNumber = 1; pageNumber <= totalPages + 1; pageNumber++) {
      const response = await page.request.post("/api/graphql", {
        headers: { Origin: PLAYWRIGHT_BASE_URL },
        data: {
          query:
            "query($page:PageInput!){catalog{busRoutes(page:$page){items{id} pageInfo{page pageSize total totalPages}}}}",
          variables: { page: { page: pageNumber, pageSize: 2 } },
        },
      });
      expect(response.status()).toBe(200);
      const graph = await response.json();
      expect(graph.errors).toBeUndefined();
      const result = graph.data.catalog.busRoutes;
      expect(result.pageInfo).toEqual({
        page: pageNumber,
        pageSize: 2,
        total: current.routes.length,
        totalPages,
      });
      const ids = result.items.map((route: { id: number }) => route.id);
      expect(ids).toEqual(
        current.routes
          .slice((pageNumber - 1) * 2, pageNumber * 2)
          .map((route) => route.id),
      );
      collected.push(...ids);
    }
    expect(collected).toEqual(listed.routes.map((route) => route.id));
    const historical = await call<BusTimetableData>(
      client,
      "catalog_bus_timetable_get",
      { versionKey: fixture.version.key, mode: "full" },
    );
    expect(historical.routes.map(({ id }) => id)).toEqual(
      fixture.routes.map(({ id }) => id),
    );
  });
});

test("bus.canonical-compact-mode", async ({ page, request }) => {
  await withFixture(page, request, async (fixture, client) => {
    const compact = await call<{
      counts: Record<string, number>;
      routes: { id: number }[];
      campuses: { id: number }[];
      trips?: unknown;
      nextDepartures: unknown[];
      nextDeparturesMessage: string;
    }>(client, "catalog_bus_timetable_get", {
      versionKey: fixture.version.key,
      locale: "en-us",
    });
    expect(compact.counts).toEqual({
      campuses: 3,
      routes: 2,
      weekdayTrips: 3,
      saturdayTrips: 1,
      sundayTrips: 0,
    });
    expect(compact.routes.map(({ id }) => id)).toEqual(
      fixture.routes.map(({ id }) => id),
    );
    expect(compact.campuses.map(({ id }) => id)).toEqual(
      fixture.campuses.map(({ id }) => id),
    );
    expect(compact.trips).toBeUndefined();
    expect(compact.nextDepartures).toEqual([]);
    expect(compact.nextDeparturesMessage).toContain(
      "catalog_bus_departure_next",
    );
    const full = await call<
      BusTimetableData & { counts: Record<string, number> }
    >(client, "catalog_bus_timetable_get", {
      versionKey: fixture.version.key,
      locale: "en-us",
      mode: "full",
    });
    expect(full.counts).toEqual(compact.counts);
    expect(full.trips).toHaveLength(4);
    expect(full.routes.every(({ stops }) => stops.length === 2)).toBe(true);
  });
});
