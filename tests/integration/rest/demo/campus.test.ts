import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const pages = ["/catalog/weather", "/catalog/bus", "/catalog/bus/map"];
const apis = [
  "/api/catalog/weather",
  "/api/catalog/bus",
  "/api/catalog/bus/routes",
  "/api/catalog/bus/next?originCampusId=153201&destinationCampusId=153202",
];
function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
}
for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo campus isolates fixed weather, bus graph and effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const db = isolatedWorker.database.owner;
      const snapshot = async () => ({
        users: await db.user.findMany({ orderBy: { id: "asc" } }),
        sessions: await db.session.findMany({
          orderBy: { sessionToken: "asc" },
        }),
        preferences: await db.busUserPreference.findMany({
          orderBy: { userId: "asc" },
        }),
      });
      const before = await snapshot();
      const signed = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const id = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${id}`;
      const headers = {
        ...secret,
        "x-test-community-probe": id,
        cookie: `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`,
        origin: isolatedWorker.origin,
      };
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      try {
        for (const path of pages) {
          const html = await request.get(path, { headers });
          expect(html.status(), path).toBe(200);
          privateHeaders(html);
          const content = await html.text();
          expect(content).toContain("demo-campus-fictional");
          expect(content).not.toContain(actor.id);
          const data = await request.get(`${path}/__data.json`, { headers });
          expect(data.status()).toBe(200);
          privateHeaders(data);
          const envelope = await data.json();
          const page = unflatten(envelope.nodes.at(-1).data) as {
            demo: { referenceNow: string };
            locations?: { snapshot: { providers: unknown[] } }[];
            bus?: { version: { key: string } };
            data?: { now: string };
          };
          expect(page.demo.referenceNow).toBe("2026-09-24T09:00:00+08:00");
          if (path === "/catalog/weather")
            expect(
              page.locations?.map(({ snapshot }) => snapshot.providers),
            ).toEqual([[], []]);
          if (path === "/catalog/bus")
            expect(page.bus?.version.key).toBe("demo-reference-2026");
          if (path.endsWith("/map"))
            expect(page.data?.now).toBe("2026-09-24T09:00:00+08:00");
        }
        const weather = await request.get("/api/catalog/weather", { headers });
        expect(weather.status()).toBe(200);
        privateHeaders(weather);
        const weatherSnapshot = await weather.json();
        expect(weatherSnapshot).toMatchObject({
          location: { key: "ustc-main", adcode: "" },
          fetchedAt: "2026-09-24T09:00:00+08:00",
          providers: [],
          current: { temperature: 24, condition: { icon: "wmo-0" } },
          extensions: {},
        });
        expect(weatherSnapshot.current).not.toHaveProperty("source");
        expect(weatherSnapshot.current).not.toHaveProperty("observedAt");
        expect(weatherSnapshot.hourly).toHaveLength(12);
        expect(weatherSnapshot.daily).toHaveLength(7);
        const gaoxin = await request.get(
          "/api/catalog/weather?locationKey=ustc-gaoxin",
          { headers },
        );
        expect(gaoxin.status()).toBe(200);
        expect((await gaoxin.json()).current.temperature).toBe(25);
        const bus = await request.get("/api/catalog/bus", { headers });
        expect(bus.status()).toBe(200);
        privateHeaders(bus);
        const timetable = await bus.json();
        expect(timetable.version.key).toBe("demo-reference-2026");
        expect(timetable.fetchedAt).toBe("2026-09-24T09:00:00+08:00");
        expect(
          timetable.campuses.map((campus: { id: number }) => campus.id),
        ).toEqual([153201, 153202, 153203, 153204, 153205, 153206]);
        expect(timetable.routes).toHaveLength(5);
        expect(timetable.trips).toHaveLength(15);
        expect(timetable.preferences).toBeNull();
        const routes = await request.get(
          "/api/catalog/bus/routes?originCampusId=153201&destinationCampusId=153202",
          { headers },
        );
        expect(routes.status()).toBe(200);
        privateHeaders(routes);
        expect(await routes.json()).toMatchObject({
          total: 1,
          routes: [
            { id: 153211, weekdayTrips: 1, saturdayTrips: 1, sundayTrips: 1 },
          ],
        });
        const next = await request.get(apis[3], { headers });
        expect(next.status()).toBe(200);
        privateHeaders(next);
        expect(await next.json()).toMatchObject({
          atTime: "2026-09-24T01:00:00.000Z",
          dayType: "weekday",
          totalRoutes: 1,
          departures: [
            {
              tripId: 153220,
              departureTime: "09:05",
              minutesUntilDeparture: 5,
            },
          ],
        });
        const sunday = await request.get(
          `${apis[3]}&atTime=2026-09-27T01%3A00%3A00Z&dayType=auto`,
          { headers },
        );
        expect(sunday.status()).toBe(200);
        expect(await sunday.json()).toMatchObject({
          dayType: "sunday",
          departures: [{ tripId: 153230 }],
        });
        const departed = await request.get(
          `${apis[3]}&atTime=2026-09-24T02%3A00%3A00Z&includeDeparted=true`,
          { headers },
        );
        expect(departed.status()).toBe(200);
        expect(await departed.json()).toMatchObject({
          departures: [{ status: "departed", minutesUntilDeparture: -55 }],
        });
        const summary = await request.get("/_internal/home/campus-now", {
          headers,
        });
        expect(summary.status()).toBe(200);
        const home = await summary.json();
        expect(
          home.weather.map((item: { temperature: string }) => item.temperature),
        ).toEqual(["24°C", "25°C"]);
        expect(
          home.bus.departures.map(
            (item: { departureTime: string }) => item.departureTime,
          ),
        ).toEqual(["09:05", "09:20", "09:35", "09:50", "10:05"]);
        for (const [path, status] of [
          ["/api/catalog/weather?locationKey=real-campus", 400],
          [
            "/api/catalog/weather?locationKey=ustc-main&locationKey=ustc-gaoxin",
            400,
          ],
          ["/api/catalog/weather?provider=amap", 400],
          ["/api/catalog/bus?versionKey=real-version", 404],
          ["/api/catalog/bus?routeId=1", 400],
          ["/api/catalog/bus/routes?originCampusId=1", 404],
          ["/api/catalog/bus/routes?stopId=1", 400],
          [
            "/api/catalog/bus/next?originCampusId=1&destinationCampusId=153202",
            404,
          ],
          [`${apis[3]}&atTime=`, 400],
          [`${apis[3]}&atTime=2030-01-01T00%3A00%3A00Z`, 404],
          [`${apis[3]}&limit=51`, 400],
          [`${apis[3]}&versionKey=other`, 404],
          ["/api/workspace/bus-preferences", 403],
        ] as const) {
          const response = await request.get(path, { headers });
          expect(response.status(), path).toBe(status);
          privateHeaders(response);
          await response.body();
        }
        for (const path of [
          ...pages,
          ...pages.map((path) => `${path}/__data.json`),
          ...apis,
        ]) {
          const head = await request.head(path, { headers });
          expect(head.status(), path).toBe(200);
          privateHeaders(head);
          expect((await head.body()).length).toBe(0);
          for (const [cookie, status] of [
            [`${expired.name}=${expired.value}`, 401],
            [
              `${signed.name}=${signed.value}; ${actor.cookie.name}=${actor.cookie.value}`,
              403,
            ],
          ] as const) {
            const response = await request.get(path, {
              headers: { ...headers, cookie },
              maxRedirects: 0,
            });
            expect(response.status(), path).toBe(status);
            privateHeaders(response);
            await response.body();
          }
          const write = await request.post(path, { headers, data: {} });
          expect(write.status(), path).toBe(403);
          privateHeaders(write);
          await write.body();
        }
        const effectsResponse = await request.get(probe, { headers: secret });
        expect(effectsResponse.status()).toBe(200);
        const effects = await effectsResponse.json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        for (const path of [
          ...pages,
          ...pages.map((path) => `${path}/__data.json`),
          ...apis,
        ]) {
          for (const method of ["GET", "HEAD"])
            expect(effects.requests).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  outcome: "fulfilled",
                  value: expect.objectContaining({
                    method,
                    path: new URL(path, isolatedWorker.origin).pathname,
                  }),
                }),
              ]),
            );
        }
        expect(
          effects.requests.every(
            (entry: { outcome: string }) => entry.outcome === "fulfilled",
          ),
        ).toBe(true);
        expect(await snapshot()).toEqual(before);
      } finally {
        const response = await request.delete(probe, { headers: secret });
        await response.body();
        expect(response.status()).toBe(204);
      }
    });
  });
}
