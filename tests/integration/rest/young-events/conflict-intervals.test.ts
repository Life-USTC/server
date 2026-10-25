import { expect } from "@playwright/test";
import { test as baseTest } from "../../../e2e/utils/owned-worker";

const cases = [
  {
    youngId: "known",
    expected: [
      {
        startAt: "2026-09-15T10:00:00+08:00",
        endAt: "2026-09-15T12:00:00+08:00",
      },
    ],
  },
  {
    youngId: "campaign",
    categoryCode: "1",
    startAt: "2026-09-01T00:00:00+08:00",
    endAt: "2026-09-30T23:59:00+08:00",
    expected: [],
  },
  { youngId: "missing-end", endAt: null, expected: [] },
  { youngId: "zero-length", endAt: "2026-09-15T10:00:00+08:00", expected: [] },
  {
    youngId: "invalid-slot",
    places: [
      {
        placeInfo: "Lab",
        placeSt: "2026-09-15 11:00:00",
        placeEt: "2026-09-15 10:00:00",
      },
    ],
    expected: [],
  },
  {
    youngId: "incomplete-slot",
    places: [
      { placeInfo: "Lab", placeSt: "2026-09-15 11:00:00", placeEt: null },
    ],
    expected: [],
  },
  {
    youngId: "series",
    categoryCode: "1",
    startAt: "2026-09-14T00:00:00+08:00",
    endAt: "2026-09-16T00:00:00+08:00",
    places: [
      {
        placeInfo: "Lab",
        placeSt: "2026-09-14 23:00:00",
        placeEt: "2026-09-15 01:00:00",
      },
      {
        placeInfo: "Lab",
        placeSt: "2026-09-15 13:00:00",
        placeEt: "2026-09-15 14:00:00",
      },
    ],
    expected: [
      {
        startAt: "2026-09-14T23:00:00+08:00",
        endAt: "2026-09-15T01:00:00+08:00",
      },
      {
        startAt: "2026-09-15T13:00:00+08:00",
        endAt: "2026-09-15T14:00:00+08:00",
      },
    ],
  },
];

const test = baseTest.extend<{ events: undefined }>({
  events: [
    async ({ isolatedWorker, run }, use) => {
      await run(() =>
        isolatedWorker.database.owner.youngEvent.createMany({
          data: cases.map(({ expected: _expected, ...event }) => ({
            name: event.youngId,
            isActive: true,
            rawJson: {},
            categoryCode: "0",
            formCode: "0",
            startAt: "2026-09-15T10:00:00+08:00",
            endAt: "2026-09-15T12:00:00+08:00",
            ...event,
          })),
        }),
      );
      await use(undefined);
    },
    { auto: true },
  ],
});

test("public list returns known conflict intervals instead of display envelopes", {
  tag: "@Young/REST",
}, async ({ request, run }) => {
  await run(async () => {
    const response = await request.get(
      "/api/catalog/young-events?pageSize=100",
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.pagination.total).toBe(cases.length);
    expect(body.data).toHaveLength(cases.length);
    for (const event of cases) {
      expect(
        body.data.find(
          (row: { youngId: string }) => row.youngId === event.youngId,
        ),
      ).toMatchObject({
        youngId: event.youngId,
        conflictIntervals: event.expected,
      });
    }
  });
});

test("public detail returns canonical conflict intervals", {
  tag: "@Young/REST",
}, async ({ request, run }) => {
  await run(async () => {
    for (const event of cases) {
      const response = await request.get(
        `/api/catalog/young-events/${event.youngId}`,
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        youngId: event.youngId,
        conflictIntervals: event.expected,
      });
    }
  });
});

test("personal subscription summaries return canonical conflict intervals", {
  tag: "@Young/REST",
}, async ({ isolatedWorker, run }) => {
  await run(async () => {
    const actor = await isolatedWorker.createActor();
    await isolatedWorker.database.owner.userYoungEventSubscription.createMany({
      data: cases.map(({ youngId }) => ({
        userId: actor.id,
        youngId,
        observedState: "[]",
      })),
    });
    const response = await actor.request.get(
      "/api/workspace/young-event-subscriptions?pageSize=100",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const body = await response.json();
    expect(body.pagination.total).toBe(cases.length);
    expect(body.data).toHaveLength(cases.length);
    for (const event of cases) {
      expect(
        body.data.find(
          (row: { youngId: string }) => row.youngId === event.youngId,
        )?.event,
      ).toMatchObject({
        youngId: event.youngId,
        conflictIntervals: event.expected,
      });
    }
  });
});
