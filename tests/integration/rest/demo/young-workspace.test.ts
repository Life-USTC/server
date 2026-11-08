import { type APIRequestContext, expect } from "@playwright/test";
import { unflatten } from "devalue";
import {
  youngEventState,
  youngReminderCandidates,
} from "../../../../src/features/young/server/young-notification-state";
import {
  personalCalendarPageSchema,
  youngEventSubscriptionListSchema,
  youngEventSubscriptionStateSchema,
  youngNotificationListSchema,
  youngOrganizerSubscriptionListSchema,
  youngOrganizerSubscriptionStateSchema,
} from "../../../../src/lib/api/schemas/young-workspace-schemas";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const page = "/workspace/subscriptions/activities";
const eventApi = "/api/workspace/young-event-subscriptions";
const organizerApi = "/api/workspace/young-organizer-subscriptions";
const notificationApi = "/api/workspace/young-notifications";
const eventIds = [1, 9, ...Array.from({ length: 19 }, (_, i) => i + 24)].map(
  (n) => `demo-young-${n}`,
);
const organizerIds = Array.from(
  { length: 21 },
  (_, i) => `demo-young-organizer-${i + 1}`,
);
async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const rows: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    rows[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${name}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return rows;
}
type Read = (
  path: string,
  status?: number,
  method?: string,
  extra?: Record<string, string>,
  data?: unknown,
) => ReturnType<APIRequestContext["fetch"]>;
async function observe(
  request: APIRequestContext,
  worker: IsolatedWorker,
  cookie: string,
  body: (read: Read) => Promise<void>,
) {
  const before = await snapshot(worker);
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const probe = `/__test/community-effects?id=${crypto.randomUUID()}`;
  const registration = await request.post(`${probe}&io=1`, { headers: secret });
  await registration.body();
  expect(registration.status()).toBe(201);
  const admitted: { method: string; path: string }[] = [];
  const read: Read = async (
    path,
    status = 200,
    method = "GET",
    extra = {},
    data,
  ) => {
    admitted.push({ method, path: new URL(path, worker.origin).pathname });
    const response = await request.fetch(path, {
      method,
      data,
      maxRedirects: 0,
      headers: {
        ...secret,
        "x-test-community-probe":
          new URL(probe, worker.origin).searchParams.get("id") ?? "",
        cookie,
        origin: worker.origin,
        accept: "application/json",
        ...extra,
      },
    });
    await response.body();
    expect(response.status(), `${method} ${path}`).toBe(status);
    expect(response.headers()).toMatchObject({
      "cache-control": "private, no-store",
      "cloudflare-cdn-cache-control": "no-store",
      vary: "Cookie",
      "x-robots-tag": "noindex, nofollow, noarchive",
    });
    expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
    return response;
  };
  try {
    await body(read);
    const response = await request.get(probe, { headers: secret });
    expect(response.status()).toBe(200);
    const effects = await response.json();
    expect(effects).toMatchObject({
      purges: [],
      messages: [],
      backgroundErrors: [],
      io: { bindings: [], outbound: [] },
    });
    expect(
      effects.requests.every(
        (item: { outcome: string }) => item.outcome === "fulfilled",
      ),
    ).toBe(true);
    for (const entry of admitted)
      expect(effects.requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcome: "fulfilled",
            value: expect.objectContaining(entry),
          }),
        ]),
      );
    const counts = new Map<
      string,
      { method: string; path: string; count: number }
    >();
    for (const entry of admitted) {
      const key = `${entry.method} ${entry.path}`;
      const previous = counts.get(key);
      counts.set(key, { ...entry, count: (previous?.count ?? 0) + 1 });
    }
    for (const entry of counts.values())
      expect(
        effects.requests.filter(
          (item: { value: { method: string; path: string } }) =>
            item.value.method === entry.method &&
            item.value.path === entry.path,
        ),
      ).toHaveLength(entry.count);
    expect(await snapshot(worker)).toEqual(before);
  } finally {
    const deleted = await request.delete(probe, { headers: secret });
    await deleted.body();
    expect(deleted.status()).toBe(204);
  }
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo activity subscriptions share fixed facts and seal notification refresh ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const ordinaryOrganizer = await db.youngOrganizer.create({
        data: {
          name: "Private reminder organizer",
          normalizedName: `private-reminders-${crypto.randomUUID()}`,
        },
      });
      const ordinaryEvent = await db.youngEvent.create({
        data: {
          youngId: `private-reminder-${crypto.randomUUID()}`,
          name: "Private reminder event sentinel",
          organizerId: ordinaryOrganizer.id,
          organizer: ordinaryOrganizer.name,
          startAt: new Date(Date.now() + 2 * 86400000),
          endAt: new Date(Date.now() + 2 * 86400000 + 3600000),
          isActive: true,
          rawJson: {},
        },
      });
      await db.userYoungEventSubscription.create({
        data: {
          userId: actor.id,
          youngId: ordinaryEvent.youngId,
          observedState: youngEventState(ordinaryEvent),
          remindSignup: false,
          remindDeadline: false,
          remindStart: false,
        },
      });
      await db.userYoungOrganizerSubscription.create({
        data: { userId: actor.id, organizerId: ordinaryOrganizer.id },
      });
      const privateNotification = await db.youngNotification.create({
        data: {
          userId: actor.id,
          youngId: ordinaryEvent.youngId,
          kind: "event_changed",
          title: "Private notification sentinel",
          body: "Private owner's notification body",
          dedupeKey: crypto.randomUUID(),
        },
      });
      const privateValues = [
        actor.id,
        ordinaryOrganizer.id,
        ordinaryOrganizer.name,
        ordinaryOrganizer.normalizedName,
        ordinaryEvent.youngId,
        ordinaryEvent.name,
        privateNotification.id,
        privateNotification.title,
        "Private owner's notification body",
      ];
      const ordinaryHeaders = {
        cookie: `${actor.cookie.name}=${actor.cookie.value}`,
      };
      for (const [path, schema, expected] of [
        [
          eventApi,
          youngEventSubscriptionListSchema,
          { youngId: ordinaryEvent.youngId },
        ],
        [
          organizerApi,
          youngOrganizerSubscriptionListSchema,
          { organizerId: ordinaryOrganizer.id },
        ],
        [
          notificationApi,
          youngNotificationListSchema,
          { id: privateNotification.id, title: privateNotification.title },
        ],
      ] as const) {
        const response = await request.get(path, { headers: ordinaryHeaders });
        expect(response.status()).toBe(200);
        const raw: unknown = await response.json();
        const data = schema.parse(raw);
        expect(data).toEqual(raw);
        expect(data.pagination.total).toBe(1);
        expect(data.data).toEqual([expect.objectContaining(expected)]);
      }
      // The real ordinary refresh has settled before the complete database snapshot.
      const signed = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
      await observe(request, isolatedWorker, cookie, async (read) => {
        async function json<Schema extends { parse(input: unknown): unknown }>(
          path: string,
          schema: Schema,
        ): Promise<ReturnType<Schema["parse"]>> {
          const raw: unknown = await (await read(path)).json();
          const parsed = schema.parse(raw);
          expect(parsed).toEqual(raw);
          expect(JSON.stringify(raw)).not.toContain("Private");
          expect(JSON.stringify(raw)).not.toContain(actor.id);
          return parsed as ReturnType<Schema["parse"]>;
        }
        async function data(path: string) {
          const envelope: unknown = await (await read(path)).json();
          if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
            throw new Error("Missing real page-data envelope");
          const node = envelope.nodes.at(-1);
          if (!isRecord(node) || !Array.isArray(node.data))
            throw new Error("Missing real flattened page-data");
          const value: unknown = unflatten(node.data);
          if (!isRecord(value)) throw new Error("Expected page data object");
          for (const privateValue of privateValues)
            expect(JSON.stringify(value)).not.toContain(privateValue);
          return value;
        }
        const events = await json(
          `${eventApi}?pageSize=100`,
          youngEventSubscriptionListSchema,
        );
        const organizers = await json(
          `${organizerApi}?pageSize=100`,
          youngOrganizerSubscriptionListSchema,
        );
        const notifications = await json(
          `${notificationApi}?pageSize=100`,
          youngNotificationListSchema,
        );
        expect(events.pagination.total).toBe(21);
        expect(events.data.map(({ youngId }) => youngId).sort()).toEqual(
          [...eventIds].sort(),
        );
        expect(organizers.pagination.total).toBe(21);
        expect(
          organizers.data.map(({ organizerId }) => organizerId).sort(),
        ).toEqual([...organizerIds].sort());
        expect(notifications.pagination.total).toBe(23);
        expect(
          notifications.data.filter(({ readAt }) => readAt === null),
        ).toHaveLength(21);
        expect(new Set(notifications.data.map(({ id }) => id)).size).toBe(23);
        expect(new Set(notifications.data.map(({ kind }) => kind))).toEqual(
          new Set([
            "event_changed",
            "organizer_digest",
            "event_start",
            "signup_deadline",
            "signup_open",
          ]),
        );
        for (const [view, api, schema, all] of [
          ["events", eventApi, youngEventSubscriptionListSchema, events],
          [
            "organizers",
            organizerApi,
            youngOrganizerSubscriptionListSchema,
            organizers,
          ],
          [
            "notifications",
            notificationApi,
            youngNotificationListSchema,
            notifications,
          ],
        ] as const) {
          const first = await json(api, schema);
          const second = await json(`${api}?page=2`, schema);
          expect(first.data).toHaveLength(20);
          expect(second.data).toHaveLength(view === "notifications" ? 3 : 1);
          expect([...first.data, ...second.data]).toEqual(all.data);
          const html = await (
            await read(`${page}?view=${view}`, 200, "GET", {
              accept: "text/html",
            })
          ).text();
          expect(html).toContain(locale === "en-us" ? "Fictional" : "虚构");
          for (const privateValue of privateValues)
            expect(html).not.toContain(privateValue);
          const loaded = await data(`${page}/__data.json?view=${view}`);
          expect(loaded.demo).toMatchObject({
            referenceNow: "2026-09-24T09:00:00+08:00",
          });
          expect(loaded.unreadActivityNotificationsCount).toBe(21);
          const selected = schema.parse(loaded[view]);
          expect(selected).toEqual(loaded[view]);
          expect(selected).toEqual(first);
          for (const other of ["events", "organizers", "notifications"])
            if (other !== view) expect(loaded[other]).toBeNull();
          const lastData = await data(
            `${page}/__data.json?view=${view}&page=2`,
          );
          expect(lastData[view]).toEqual(second);
          const redirected = await read(
            `${page}?view=${view}&page=999`,
            303,
            "GET",
            { accept: "text/html" },
          );
          expect(
            new URL(
              redirected.headers().location,
              isolatedWorker.origin,
            ).searchParams.get("page"),
          ).toBe("2");
          const head = await read(api, 200, "HEAD");
          expect(await head.body()).toHaveLength(0);
          for (const query of ["page=0", "pageSize=101", "unread=invalid"])
            await read(`${api}?${query}`, 400);
        }
        const unreadFirst = await json(
          `${notificationApi}?unread=true`,
          youngNotificationListSchema,
        );
        const unreadLast = await json(
          `${notificationApi}?unread=true&page=2`,
          youngNotificationListSchema,
        );
        expect(unreadFirst.pagination.total).toBe(21);
        expect(unreadFirst.data).toHaveLength(20);
        expect(unreadLast.data).toHaveLength(1);
        expect([...unreadFirst.data, ...unreadLast.data]).toEqual(
          notifications.data.filter(({ readAt }) => readAt === null),
        );
        const unreadPage = await data(
          `${page}/__data.json?view=notifications&unread=true&page=2`,
        );
        expect(unreadPage.notifications).toEqual(unreadLast);
        const fallback = await data(`${page}/__data.json?view=unknown`);
        expect(fallback.events).toEqual(
          await json(eventApi, youngEventSubscriptionListSchema),
        );
        const state = await json(
          `${eventApi}/demo-young-28`,
          youngEventSubscriptionStateSchema,
        );
        expect(state).toEqual({
          youngId: "demo-young-28",
          subscribed: true,
          remindSignup: true,
          remindDeadline: true,
          remindStart: true,
        });
        const publicDetail = await data(
          "/catalog/young-events/demo-young-28/__data.json",
        );
        expect(publicDetail.subscriptionState).toMatchObject({
          subscribed: true,
          remindSignup: true,
          remindDeadline: true,
          remindStart: true,
        });
        const event = events.data.find(
          ({ youngId }) => youngId === "demo-young-28",
        )?.event;
        if (!event) throw new Error("Missing fixed reminder event");
        const candidates = youngReminderCandidates(
          {
            ...event,
            startAt: event.startAt ? new Date(event.startAt) : null,
            endAt: event.endAt ? new Date(event.endAt) : null,
            applyStartAt: event.applyStartAt
              ? new Date(event.applyStartAt)
              : null,
            applyEndAt: event.applyEndAt ? new Date(event.applyEndAt) : null,
          },
          {
            ...state,
            createdAt: new Date(
              events.data.find(({ youngId }) => youngId === "demo-young-28")
                ?.createdAt ?? "",
            ),
          },
          new Date("2026-09-24T09:00:00+08:00"),
        );
        expect(candidates.map(({ kind }) => kind).sort()).toEqual([
          "event_start",
          "signup_deadline",
          "signup_open",
        ]);
        expect(
          await json(
            `${eventApi}/demo-young-13`,
            youngEventSubscriptionStateSchema,
          ),
        ).toMatchObject({ subscribed: false });
        expect(
          await json(
            `${organizerApi}/demo-young-organizer-22`,
            youngOrganizerSubscriptionStateSchema,
          ),
        ).toEqual({
          organizerId: "demo-young-organizer-22",
          subscribed: false,
        });
        await read(`${eventApi}/${ordinaryEvent.youngId}`, 404);
        await read(`${organizerApi}/${ordinaryOrganizer.id}`, 404);
        const calendar = await json(
          "/api/workspace/calendar/events?dateFrom=2026-09-01&dateTo=2027-01-24&pageSize=100",
          personalCalendarPageSchema,
        );
        expect(calendar.pagination.total).toBe(30);
        expect(
          calendar.data
            .filter(({ type }) => type === "young_event")
            .map(({ youngId }) => youngId)
            .sort(),
        ).toEqual([...eventIds].sort());
        const overview: unknown = await (
          await read("/_internal/home/viewer")
        ).json();
        expect(overview).toMatchObject({
          navStats: {
            unreadActivityNotificationsCount: 21,
            calendarItemsCount: 30,
          },
        });
        for (const [path, method, body] of [
          [`${eventApi}/demo-young-28`, "PUT", { subscribed: false }],
          [
            `${organizerApi}/demo-young-organizer-7`,
            "PUT",
            { subscribed: false },
          ],
          [`${notificationApi}/${notifications.data[0].id}/read`, "POST", {}],
        ] as const)
          await read(path, 403, method, {}, body);
        await read(notificationApi, 401, "GET", {
          cookie: `${expired.name}=${expired.value}`,
        });
        await read(notificationApi, 403, "GET", {
          cookie: `${cookie}; ${ordinaryHeaders.cookie}`,
        });
        await read(`${page}?view=notifications`, 403, "GET", {
          cookie: `${cookie}; ${ordinaryHeaders.cookie}`,
          accept: "text/html",
        });
        const expiredPage = await read(page, 303, "GET", {
          cookie: `${expired.name}=${expired.value}`,
          accept: "text/html",
        });
        expect(
          new URL(expiredPage.headers().location, isolatedWorker.origin)
            .pathname,
        ).toBe("/account/sign-in");
      });
    });
  });
}
