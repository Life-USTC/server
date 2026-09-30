import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect, type Page } from "@playwright/test";
import type { BusTimetableData } from "@/features/bus/lib/bus-types";
import type {
  Prisma,
  Session,
} from "../../../../../src/generated/prisma-node/client";
import type {
  CalendarProtocol,
  CalendarProtocolChecks,
} from "../../../utils/calendar-protocol-lifecycle";
import { readCalendarState } from "../../../utils/calendar-read-observation";
import { arrangeBus, facts } from "../api/mcp/_data";
import { test } from "../api/mcp/_fixture";
import type { OAuthOwner } from "../api/mcp/helpers";
import { issueAccessToken, parseTextContent } from "../api/mcp/helpers";

async function createFixture(db: Prisma.TransactionClient) {
  const marker = crypto.randomUUID().replaceAll("-", "");
  return (async () => {
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
    const firstRouteId = 1_600_000_000;
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
  })();
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;
type BusPlan = {
  tools: string[];
  graphql: number;
  reads: number;
  sessions: number;
};
async function busState(db: OAuthOwner["worker"]["database"]["owner"]) {
  return db.$transaction(async (tx) => ({
    campuses: await tx.busCampus.findMany({ orderBy: { id: "asc" } }),
    routes: await tx.busRoute.findMany({ orderBy: { id: "asc" } }),
    stops: await tx.busRouteStop.findMany({ orderBy: { id: "asc" } }),
    versions: await tx.busScheduleVersion.findMany({ orderBy: { id: "asc" } }),
    trips: await tx.busTrip.findMany({ orderBy: { id: "asc" } }),
    preferences: await tx.busUserPreference.findMany({
      orderBy: { userId: "asc" },
    }),
  }));
}
async function withFixture(
  page: Page,
  io: CalendarProtocol,
  oauthOwner: OAuthOwner,
  plan: BusPlan,
  work: (
    fixture: Fixture,
    client: Client,
    session: (userId: string) => Promise<void>,
  ) => Promise<void>,
): Promise<CalendarProtocolChecks> {
  const db = oauthOwner.worker.database.owner;
  const fixture = await db.$transaction(async (tx) => {
    await arrangeBus(tx);
    await tx.busCampus.create({
      data: {
        id: 3,
        nameCn: "验证第三校区",
        latitude: 31.86,
        longitude: 117.28,
      },
    });
    return createFixture(tx);
  });
  const before = await busState(db);
  const domain = await readCalendarState(db);
  expect(before.campuses.map(({ id }) => id)).toEqual([1, 2, 3]);
  expect(before.routes.map(({ id }) => id)).toEqual([
    facts.bus.routeId,
    1_600_000_000,
    1_600_000_001,
  ]);
  expect(before.trips).toHaveLength(10);
  expect(before.preferences).toHaveLength(2);
  const sessions: Session[] = [];
  async function session(userId: string) {
    await page.context().clearCookies();
    const actor = await oauthOwner.worker.createSession(userId);
    const added = (await db.session.findMany({ where: { userId } })).filter(
      ({ id }) => !sessions.some((prior) => prior.id === id),
    );
    expect(added).toHaveLength(1);
    const row = added[0];
    const now = new Date();
    sessions.push(
      await db.session.update({
        where: { id: row.id },
        data: {
          updatedAt: now,
          expires: new Date(now.getTime() + 30 * 86400_000),
        },
      }),
    );
    await page.context().addCookies([actor.cookie]);
  }
  await session(fixture.users[0].id);
  await io.observeCalendar(fixture.users[0], [], { calendar: "absent" });
  const resource = `${oauthOwner.worker.origin}/api/mcp`;
  const scopes = ["workspace.bus-preferences:read"];
  const token = await issueAccessToken(page, io.request, {
    owner: oauthOwner,
    scope: scopes[0],
    clientScopes: scopes,
    resource,
  });
  expect(token.refreshToken).toBeUndefined();
  const client = await io.mcp(
    { name: "bus-data-contract", version: "1" },
    token.accessToken,
  );
  await work(fixture, client, session);
  return {
    async verifyTransport({ effects, sdkRequests }) {
      expect(
        sdkRequests
          .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
          .sort(),
      ).toEqual([
        "GET stream",
        "POST initialize",
        "POST notifications/initialized",
        ...plan.tools.map(() => "POST tools/call"),
      ]);
      expect(
        sdkRequests
          .filter(({ rpc }) => rpc === "tools/call")
          .map(({ tool }) => tool),
      ).toEqual(plan.tools);
      for (const [method, path, statuses] of [
        ["POST", "/api/auth/oauth2/register", [201]],
        ["GET", "/api/auth/oauth2/authorize", [302]],
        ["POST", "/oauth/authorize", [200]],
        ["POST", "/api/auth/oauth2/token", [200]],
        ["POST", "/api/graphql", Array(plan.graphql).fill(200)],
      ] as const)
        expect(
          effects.requests
            .filter(
              ({ value }) => value.method === method && value.path === path,
            )
            .map(({ result }) => result),
        ).toEqual(statuses);
      expect(
        effects.requests.filter(
          ({ value }) =>
            value.method === "GET" && value.path === "/api/catalog/bus",
        ),
      ).toHaveLength(plan.reads);
      expect(
        effects.requests.filter(
          ({ value }) => value.method !== "GET" && value.path !== "/api/mcp",
        ),
      ).toHaveLength(3 + plan.graphql);
    },
    async verifyState() {
      expect(await busState(db)).toEqual(before);
      expect(await readCalendarState(db)).toEqual(domain);
      expect(sessions).toHaveLength(plan.sessions);
      expect(await db.session.findMany({ orderBy: { id: "asc" } })).toEqual(
        [...sessions].sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect(
        await db.oAuthClient.findMany({
          select: {
            clientId: true,
            name: true,
            userId: true,
            redirectUris: true,
            grantTypes: true,
            responseTypes: true,
            tokenEndpointAuthMethod: true,
            applicationType: true,
          },
        }),
      ).toEqual([
        {
          clientId: token.clientId,
          name: oauthOwner.clientNames[0],
          userId: null,
          redirectUris: [`${oauthOwner.worker.origin}/e2e/oauth/callback`],
          grantTypes: ["authorization_code"],
          responseTypes: ["code"],
          tokenEndpointAuthMethod: "none",
          applicationType: "native",
        },
      ]);
      expect(oauthOwner.clientNames).toHaveLength(1);
      const consents = await db.oAuthConsent.findMany({
        select: {
          userId: true,
          clientId: true,
          grantId: true,
          scopes: true,
          resources: true,
          requestedUserInfoClaims: true,
        },
      });
      expect(consents).toEqual([
        {
          userId: fixture.users[0].id,
          clientId: token.clientId,
          grantId: expect.any(String),
          scopes,
          resources: [resource],
          requestedUserInfoClaims: [],
        },
      ]);
      const grantId = consents[0].grantId;
      expect(grantId).toMatch(/^[0-9a-f-]{36}$/);
      expect(
        await db.auditLog.findMany({
          select: {
            action: true,
            outcome: true,
            channel: true,
            userId: true,
            subjectUserId: true,
            targetId: true,
            targetType: true,
            oauthClientId: true,
            oauthGrantId: true,
            sessionId: true,
            metadata: true,
          },
        }),
      ).toEqual([
        {
          action: "oauth_authorization_grant",
          outcome: "success",
          channel: "web",
          userId: fixture.users[0].id,
          subjectUserId: fixture.users[0].id,
          targetId: token.clientId,
          targetType: "oauth_client",
          oauthClientId: token.clientId,
          oauthGrantId: grantId,
          sessionId: sessions[0].id,
          metadata: {
            changedFields: ["resources", "scopes", "userinfoClaims"],
            resourceCount: 1,
            scopeCount: 1,
          },
        },
      ]);
      // Catalog bus calls remain public even when a bearer is supplied, including invalid input.
      expect(await db.oAuthGrantUsageDaily.findMany()).toEqual([]);
      expect(await db.oAuthRefreshToken.count()).toBe(0);
      expect(await db.oAuthAccessToken.count()).toBe(0);
      expect(await db.deviceCode.count()).toBe(0);
      expect(await db.upload.count()).toBe(0);
      expect(await db.uploadPending.count()).toBe(0);
    },
  };
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

test("bus.raw-data-returned", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun((io) =>
    withFixture(
      page,
      io,
      oauthOwner,
      {
        tools: ["catalog_bus_timetable_get"],
        graphql: 6,
        reads: 3,
        sessions: 3,
      },
      async (fixture, client, session) => {
        const request = io.request;
        const response = await request.get(timetableUrl(fixture.version.key));
        expect(response.status()).toBe(200);
        const anonymous = (await response.json()) as BusTimetableData;
        expect(anonymous.preferences).toBeNull();
        expect(anonymous.routes.map(({ id }) => id)).toEqual(
          fixture.routes.map(({ id }) => id),
        );
        expect(
          anonymous.routes.map(({ stops }) =>
            stops.map(({ campus }) => campus.id),
          ),
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
              headers: { Origin: oauthOwner.worker.origin },
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
          await session(fixture.users[index].id);
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
      },
    ),
  );
});

test("bus.version-key-boundary", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun((io) =>
    withFixture(
      page,
      io,
      oauthOwner,
      {
        tools: Array(11).fill("catalog_bus_timetable_get"),
        graphql: 11,
        reads: 11,
        sessions: 1,
      },
      async (fixture, client) => {
        const request = io.request;
        const graph = (versionKey: string) =>
          page.request.post("/api/graphql", {
            headers: { Origin: oauthOwner.worker.origin },
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
          expect((await request.get(timetableUrl(versionKey))).status()).toBe(
            200,
          );
          const gql = await graph(versionKey);
          expect(gql.status()).toBe(200);
          expect(await gql.json()).toMatchObject({
            data: {
              catalog: {
                busTimetable: { route: { id: fixture.routes[0].id } },
              },
            },
          });
          expect(
            (
              await call<BusTimetableData>(
                client,
                "catalog_bus_timetable_get",
                {
                  versionKey,
                  mode: "full",
                },
              )
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
          expect((await request.get(timetableUrl(versionKey))).status()).toBe(
            400,
          );
          const gql = await graph(versionKey);
          const body = await gql.json();
          expect(body.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
          const mcp = await client.callTool({
            name: "catalog_bus_timetable_get",
            arguments: { versionKey },
          });
          expect(mcp.isError).toBe(true);
        }
      },
    ),
  );
});

test("bus.current-version-only", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun((io) =>
    withFixture(
      page,
      io,
      oauthOwner,
      {
        tools: ["catalog_bus_route_list", "catalog_bus_timetable_get"],
        graphql: 2,
        reads: 1,
        sessions: 1,
      },
      async (fixture, client) => {
        const request = io.request;
        const response = await request.get("/api/catalog/bus?locale=en-us");
        expect(response.status()).toBe(200);
        const current = (await response.json()) as BusTimetableData;
        expect(current.routes.length).toBeGreaterThan(0);
        expect(current.routes.map(({ id }) => id)).toEqual([facts.bus.routeId]);
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
            headers: { Origin: oauthOwner.worker.origin },
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
      },
    ),
  );
});

test("bus.canonical-compact-mode", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun((io) =>
    withFixture(
      page,
      io,
      oauthOwner,
      {
        tools: ["catalog_bus_timetable_get", "catalog_bus_timetable_get"],
        graphql: 0,
        reads: 0,
        sessions: 1,
      },
      async (fixture, client) => {
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
      },
    ),
  );
});
