import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { WorkspaceCalendarData } from "../../../../src/features/workspace/lib/workspace-controller-types";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const paths = [
  "/",
  "/__data.json",
  "/_internal/home/viewer",
  "/_internal/home/notices",
  "/_internal/home/activities",
  "/_internal/home/campus-now?section=weather",
  "/_internal/home/campus-now?section=bus",
];
// Page-data carries Date values; JSON uses the existing Shanghai wire serializer.
// Compare those two transport representations by instant without importing it.
function calendarFacts(calendar: WorkspaceCalendarData) {
  const instant = (date: unknown) =>
    date == null
      ? null
      : date instanceof Date
        ? date.getTime()
        : Date.parse(String(date));
  return {
    ...calendar,
    allSessions: calendar.allSessions.map((session) => ({
      ...session,
      date: instant(session.date),
    })),
    allExams: calendar.allExams.map((exam) => ({
      ...exam,
      date: instant(exam.date),
    })),
  };
}
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
  test(`demo Home isolates fixed overview, public samples and effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const db = isolatedWorker.database.owner;
      const victim = await db.todo.create({
        data: {
          userId: actor.id,
          title: "Private Home owner's task",
          dueAt: new Date("2026-09-25T18:00:00+08:00"),
        },
      });
      const ordinary = await request.get(
        "/_internal/home/viewer?snapshotAt=2026-09-24T01:00:00Z",
        { headers: { cookie: `${actor.cookie.name}=${actor.cookie.value}` } },
      );
      expect(ordinary.status()).toBe(200);
      const ordinaryBody = await ordinary.json();
      expect(ordinaryBody.navStats.user.id).toBe(actor.id);
      expect(ordinaryBody.todos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: victim.id, title: victim.title }),
        ]),
      );
      // Ordinary session refresh is complete before measuring the demo boundary.
      const snapshot = async () => ({
        users: await db.user.findMany({ orderBy: { id: "asc" } }),
        sessions: await db.session.findMany({
          orderBy: { sessionToken: "asc" },
        }),
        todos: await db.todo.findMany({ orderBy: { id: "asc" } }),
      });
      const before = await snapshot();
      const signed = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const probeId = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${probeId}`;
      const headers = {
        ...secret,
        "x-test-community-probe": probeId,
        cookie: `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`,
        origin: isolatedWorker.origin,
      };
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      try {
        const html = await request.get("/", { headers });
        expect(html.status()).toBe(200);
        privateHeaders(html);
        const text = await html.text();
        expect(text).toContain(
          locale === "en-us"
            ? "Sample reading room hours"
            : "虚构阅览室开放时间",
        );
        expect(text).not.toContain(victim.title);
        expect(text).not.toContain(actor.id);
        const dataResponse = await request.get("/__data.json", { headers });
        expect(dataResponse.status()).toBe(200);
        privateHeaders(dataResponse);
        const envelope = await dataResponse.json();
        const page = unflatten(envelope.nodes.at(-1).data) as {
          information: { notices: unknown[]; activities: unknown[] };
          demo: { referenceNow: string };
        };
        expect(page.demo.referenceNow).toBe("2026-09-24T09:00:00+08:00");
        for (const module of ["notices", "activities"] as const) {
          const response = await request.get(`/_internal/home/${module}`, {
            headers,
          });
          expect(response.status()).toBe(200);
          privateHeaders(response);
          const body = await response.json();
          expect(body[module]).toEqual(page.information[module]);
          expect(body[module]).toHaveLength(5);
          expect(body[module][0].dateLabel).toBe("2026-09-24");
          expect(
            body[module].every((item: { meta: string }) =>
              item.meta.includes(locale === "en-us" ? "Fictional" : "虚构"),
            ),
          ).toBe(true);
        }
        const overview = await request.get(
          `/_internal/home/viewer?userId=${actor.id}`,
          { headers },
        );
        expect(overview.status()).toBe(200);
        privateHeaders(overview);
        const body = await overview.json();
        expect(body).toMatchObject({
          signedIn: true,
          referenceNow: "2026-09-24T09:00:00+08:00",
          navStats: {
            user: { id: "demo:workspace-v1" },
            pendingTodosCount: 2,
            pendingHomeworksCount: 3,
            examsCount: 2,
            calendarItemsCount: 9,
          },
        });
        expect(
          body.overview.pendingHomeworks.map(
            (homework: { id: string }) => homework.id,
          ),
        ).toEqual([
          "demo-homework-determinants",
          "demo-homework-vectors",
          "demo-homework-project",
        ]);
        expect(
          body.overview.calendar.allSessions.map(
            (session: { weekIndex: number }) => session.weekIndex,
          ),
        ).toEqual([4, 4]);
        expect(body.overview.calendar.allExams).toHaveLength(2);
        expect(body.todos.map((todo: { id: string }) => todo.id)).toEqual([
          "demo-todo-reading",
          "demo-todo-outline",
          "demo-todo-library",
        ]);
        expect(JSON.stringify(body)).not.toContain(victim.id);
        const calendar = await request.get("/workspace/calendar/__data.json", {
          headers,
        });
        expect(calendar.status()).toBe(200);
        const calendarEnvelope = await calendar.json();
        const calendarPage = unflatten(calendarEnvelope.nodes.at(-1).data) as {
          overview: { calendar: WorkspaceCalendarData };
        };
        expect(calendarFacts(body.overview.calendar)).toEqual(
          calendarFacts(calendarPage.overview.calendar),
        );
        for (const section of ["weather", "bus"]) {
          const response = await request.get(
            `/_internal/home/campus-now?section=${section}`,
            { headers },
          );
          expect(response.status()).toBe(200);
          privateHeaders(response);
          const sample = await response.json();
          expect(sample[section === "bus" ? "weather" : "bus"]).toBeNull();
          if (section === "weather") {
            expect(sample.weather).toHaveLength(2);
            expect(
              sample.weather[0].hourly.map(
                (hour: { label: string }) => hour.label,
              ),
            ).toEqual(["09:00", "10:00", "11:00"]);
          } else {
            expect(
              sample.bus.departures.map(
                (departure: { departureTime: string }) =>
                  departure.departureTime,
              ),
            ).toEqual(["09:05", "09:20", "09:35", "09:50", "10:05"]);
            expect(sample.bus.originNote).toContain(
              locale === "en-us" ? "Not a real timetable" : "非真实时刻表",
            );
          }
        }
        for (const path of paths) {
          const response = await request.head(path, { headers });
          expect(response.status(), path).toBe(200);
          expect(await response.text()).toBe("");
          privateHeaders(response);
        }
        for (const query of [
          "snapshotAt=2040-01-01",
          "overviewWeek=2025-01-01",
          "overviewWeek=2026-02-30",
        ]) {
          const response = await request.get(
            `/_internal/home/viewer?${query}`,
            { headers },
          );
          expect(response.status()).toBe(400);
          expect(await response.json()).toEqual({
            error: "DEMO_HOME_RANGE_INVALID",
          });
          privateHeaders(response);
        }
        for (const path of [
          "/api/catalog/links/resolve?slug=sample",
          "/_internal/home/unknown",
        ]) {
          const response = await request.get(path, {
            headers,
            maxRedirects: 0,
          });
          expect(response.status(), path).toBe(403);
          expect(await response.json()).toEqual({ error: "DEMO_READ_ONLY" });
          privateHeaders(response);
        }
        for (const [method, path] of [
          ["POST", "/"],
          ["POST", "/_internal/home/viewer"],
          ["POST", "/api/workspace/link-pins"],
          ["DELETE", "/api/workspace/link-pins"],
        ]) {
          const response = await request.fetch(path, {
            method,
            headers,
            data: { slug: "sample" },
          });
          expect(response.status()).toBe(403);
          expect(await response.json()).toEqual({ error: "DEMO_READ_ONLY" });
          privateHeaders(response);
        }
        for (const path of paths) {
          for (const [cookie, status] of [
            ["life-ustc.demo=invalid", 401],
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
            await response.body();
            privateHeaders(response);
          }
        }
        const invalidHtml = await request.get("/", {
          headers: {
            ...headers,
            cookie: `life-ustc.demo=${expired.value}`,
            accept: "text/html",
          },
          maxRedirects: 0,
        });
        expect(invalidHtml.status()).toBe(303);
        expect(invalidHtml.headers().location).toBe("/account/sign-in");
        await invalidHtml.body();
        const effectsResponse = await request.get(probe, { headers: secret });
        expect(effectsResponse.status()).toBe(200);
        const effects = await effectsResponse.json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        for (const path of paths) {
          const pathname = new URL(path, isolatedWorker.origin).pathname;
          for (const method of ["GET", "HEAD"])
            expect(effects.requests).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  outcome: "fulfilled",
                  value: expect.objectContaining({ method, path: pathname }),
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
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      }
    });
  });
}
