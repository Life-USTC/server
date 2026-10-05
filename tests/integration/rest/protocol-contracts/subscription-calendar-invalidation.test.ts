import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";

type CalendarState = {
  attempts: {
    id: string;
    attempts: number;
    userId: string;
    ackCalls: number;
    retryCalls: number;
    complete: boolean;
    errors: string[];
    calendar: string | null;
  }[];
  calendar: string | null;
};

for (const entry of ["rest-batch", "graphql"] as const) {
  test(
    `subscription removal rebuilds the stored calendar through ${entry}`,
    {
      tag: `@Subscription/${entry === "graphql" ? "GraphQL" : "REST"}`,
    },
    async ({ isolatedWorker, run }, testInfo) => {
      await run(async () => {
        const db = isolatedWorker.database.owner;
        const actor = await isolatedWorker.createActor();
        const catalog = await db.$transaction(async (tx) => {
          const semester = await tx.semester.create({
            data: { jwId: 421, code: "421", nameCn: "独立日历学期" },
          });
          const course = await tx.course.create({
            data: {
              jwId: 101,
              code: "ICS101",
              nameCn: "Calendar unsubscribe regression",
            },
          });
          const section = await tx.section.create({
            data: {
              jwId: 102,
              code: "ICS101.01",
              courseId: course.id,
              semesterId: semester.id,
            },
          });
          const group = await tx.scheduleGroup.create({
            data: {
              jwId: 103,
              sectionId: section.id,
              no: 1,
              limitCount: 20,
              stdCount: 1,
              actualPeriods: 2,
              isDefault: true,
            },
          });
          const date = new Date(Date.now() + 86_400_000);
          date.setUTCHours(0, 0, 0, 0);
          const schedule = await tx.schedule.create({
            data: {
              sectionId: section.id,
              scheduleGroupId: group.id,
              date,
              weekday: date.getUTCDay() || 7,
              startTime: 900,
              endTime: 1000,
              startUnit: 1,
              endUnit: 2,
              weekIndex: 1,
              periods: 2,
              customPlace: "Calendar regression classroom",
            },
          });
          return { section, schedule };
        });
        const secret = {
          "x-test-storage-secret": "local-test-storage-observer",
        };
        const probeId = crypto.randomUUID();
        const producerPath = `/__test/community-effects?id=${probeId}`;
        const consumerPath = `/__test/calendar-consumer?userId=${actor.id}`;
        const headers = { ...secret, "x-test-community-probe": probeId };
        expect(
          (
            await actor.request.post(producerPath, { headers: secret })
          ).status(),
        ).toBe(201);
        expect(
          (
            await actor.request.post(consumerPath, { headers: secret })
          ).status(),
        ).toBe(201);
        const readCalendar = async (): Promise<CalendarState> => {
          const response = await actor.request.get(consumerPath, {
            headers: secret,
          });
          expect(response.status()).toBe(200);
          return response.json();
        };
        const readEffects = async () => {
          const response = await actor.request.get(producerPath, {
            headers: secret,
          });
          expect(response.status()).toBe(200);
          return response.json();
        };
        const expectConsumer = async (count: number) => {
          await expect
            .poll(
              async () => {
                const state = await readCalendar();
                return (
                  state.attempts.length >= count &&
                  state.attempts.every((attempt) => attempt.complete)
                );
              },
              {
                timeout: 10_000,
                message:
                  "The real queue must persist the updated private export",
              },
            )
            .toBe(true);
          const state = await readCalendar();
          expect(state.attempts).toHaveLength(count);
          expect(
            new Set(state.attempts.map((attempt) => attempt.id)).size,
          ).toBe(count);
          for (const attempt of state.attempts)
            expect(attempt).toMatchObject({
              attempts: 1,
              userId: actor.id,
              ackCalls: 1,
              retryCalls: 0,
              complete: true,
              errors: [],
              calendar: expect.any(String),
            });
          expect(
            state.attempts.some(
              (attempt) => attempt.calendar === state.calendar,
            ),
          ).toBe(true);
          expect(await readEffects()).toMatchObject({
            backgroundErrors: [],
            messages: Array.from({ length: count }, () => ({
              outcome: "fulfilled",
              value: { type: "user", userId: actor.id },
            })),
          });
          return state;
        };
        const memberships = () =>
          db.userSectionSubscription.findMany({
            where: { userId: actor.id },
            select: { sectionId: true, kind: true },
          });
        try {
          const added = await actor.request.post(
            "/api/workspace/subscriptions/batch",
            {
              headers,
              data: { action: "add", sectionIds: [catalog.section.id] },
            },
          );
          expect(added.status()).toBe(200);
          expect(await added.json()).toMatchObject({
            action: "add",
            addedCount: 1,
            removedCount: 0,
            unchangedCount: 0,
          });
          expect(await memberships()).toEqual([
            { sectionId: catalog.section.id, kind: "regular" },
          ]);
          const before = await expectConsumer(1);
          const beforeText = JSON.parse(before.calendar ?? "null").text.replace(
            /\r?\n[ \t]/g,
            "",
          );
          expect(beforeText).toContain(
            `UID:https://life-ustc.tiankaima.dev/schedule/${catalog.schedule.id}`,
          );
          expect(beforeText).toContain(
            "SUMMARY:Calendar unsubscribe regression",
          );
          expect(beforeText).toContain(
            "LOCATION:Calendar regression classroom",
          );
          await testInfo.attach("calendar-before-removal", {
            body: JSON.stringify(before),
            contentType: "application/json",
          });
          if (entry === "rest-batch") {
            const removed = await actor.request.post(
              "/api/workspace/subscriptions/batch",
              {
                headers,
                data: { action: "remove", sectionIds: [catalog.section.id] },
              },
            );
            expect(removed.status()).toBe(200);
            expect(await removed.json()).toMatchObject({
              action: "remove",
              addedCount: 0,
              removedCount: 1,
              unchangedCount: 0,
              subscription: { userId: actor.id, sections: [] },
            });
          } else {
            const removed = await actor.request.post("/api/graphql", {
              headers,
              data: {
                query:
                  "mutation($jwId: Int!) { subscriptionRemove(jwId: $jwId) { sectionJwId subscribed } }",
                variables: { jwId: catalog.section.jwId },
              },
            });
            expect(removed.status()).toBe(200);
            expect(await removed.json()).toEqual({
              data: {
                subscriptionRemove: {
                  sectionJwId: catalog.section.jwId,
                  subscribed: false,
                },
              },
            });
          }
          expect(await memberships()).toEqual([]);
          const after = await expectConsumer(2);
          const afterText = JSON.parse(after.calendar ?? "null").text.replace(
            /\r?\n[ \t]/g,
            "",
          );
          expect(afterText).toContain("BEGIN:VCALENDAR");
          expect(afterText).not.toContain(
            `UID:https://life-ustc.tiankaima.dev/schedule/${catalog.schedule.id}`,
          );
          expect(afterText).not.toContain(
            "SUMMARY:Calendar unsubscribe regression",
          );
          expect(afterText).not.toContain("BEGIN:VEVENT");
        } finally {
          // Preserve committed membership and actual KV even on a missing consumer;
          // never call the feed route, which could rebuild and conceal this bug.
          await testInfo.attach("calendar-after-removal", {
            body: JSON.stringify({
              memberships: await memberships(),
              calendar: await readCalendar(),
              effects: await readEffects(),
            }),
            contentType: "application/json",
          });
        }
      });
    },
  );
}
