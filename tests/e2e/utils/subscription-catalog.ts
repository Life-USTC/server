import { randomInt } from "node:crypto";
import { expect } from "@playwright/test";
import type {
  Course,
  Section,
  Semester,
  Teacher,
} from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

type Catalog = {
  course: Course & { nameEn: string };
  section: Section;
  sections: Section[];
  teacher: Teacher & { nameEn: string };
  sharedTeacher: Teacher;
  current: Semester;
  previous: Semester;
};

type CalendarObservation = {
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
type Effects = {
  messages: { outcome: string; value: unknown }[];
  purges: { outcome: string }[];
  backgroundErrors: string[];
};

/** Each browser workflow owns its actor, semester catalog and native Worker. */
export const test = workerTest.extend<{
  account: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  subscriptionDb: <T>(work: (db: TestPrismaClient) => Promise<T>) => Promise<T>;
  storedSectionSubscriptions: (
    userId: string,
  ) => Promise<
    Awaited<ReturnType<TestPrismaClient["userSectionSubscription"]["findMany"]>>
  >;
  subscriptionRun: (work: () => Promise<void>) => Promise<void>;
  semesters: { current: Semester; previous: Semester };
  catalog: Catalog;
  subscriptions: Catalog;
}>({
  account: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  subscriptionDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  storedSectionSubscriptions: async ({ subscriptionDb }, use) => {
    await use((userId) =>
      subscriptionDb((db) =>
        db.userSectionSubscription.findMany({
          where: { userId },
          orderBy: { sectionId: "asc" },
        }),
      ),
    );
  },
  semesters: async ({ subscriptionDb }, use) => {
    // Preserve the original display names and relative semester ordering while
    // creating the prerequisites in this case's private database.
    const endDate = new Date(Date.now() + 180 * 86_400_000);
    await use(
      await subscriptionDb((db) =>
        db.$transaction(async (tx) => ({
          current: await tx.semester.create({
            data: {
              jwId: 9900001,
              nameCn: "2026年春季学期",
              code: "421",
              startDate: new Date("2026-04-08"),
              endDate,
            },
          }),
          previous: await tx.semester.create({
            data: {
              jwId: 9900000,
              nameCn: "2025年秋季学期",
              code: "420",
              startDate: new Date("2025-10-21"),
              endDate: new Date("2026-03-30"),
            },
          }),
        })),
      ),
    );
  },
  catalog: async (
    { account: _account, semesters: { current, previous }, subscriptionDb },
    use,
  ) => {
    const marker = crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 10)
      .toUpperCase();
    const jwId = randomInt(1_200_000_000, 1_300_000_000);
    const catalog = await subscriptionDb((db) =>
      db.$transaction(async (tx) => {
        const teacher = await tx.teacher.create({
          data: {
            jwId,
            nameCn: `独立教师 ${marker}`,
            nameEn: `Private teacher ${marker}`,
          },
        });
        const sharedTeacher = await tx.teacher.create({
          data: {
            jwId: jwId + 1,
            nameCn: `共同教师 ${marker}`,
            nameEn: `Joint teacher ${marker}`,
          },
        });
        const courses = [];
        const sections = [];
        for (let index = 0; index < 4; index += 1) {
          const course = await tx.course.create({
            data: {
              jwId: jwId + index,
              code: `SC${marker}${index}`,
              nameCn: `独立订阅课程 ${marker} ${index}`,
              nameEn: `Private subscription course ${marker} ${index}`,
            },
          });
          courses.push(course);
          sections.push(
            await tx.section.create({
              data: {
                jwId: jwId + index,
                code: `${course.code}.01`,
                courseId: course.id,
                semesterId: index === 3 ? previous.id : current.id,
                credits: 3,
                teachers: {
                  connect:
                    index === 0
                      ? [{ id: teacher.id }, { id: sharedTeacher.id }]
                      : index === 1
                        ? [{ id: sharedTeacher.id }]
                        : [],
                },
              },
            }),
          );
        }
        if (!courses[0].nameEn || !teacher.nameEn)
          throw new Error("Expected bilingual fixture catalog");
        return {
          course: { ...courses[0], nameEn: courses[0].nameEn },
          section: sections[0],
          sections,
          teacher: { ...teacher, nameEn: teacher.nameEn },
          sharedTeacher,
          current,
          previous,
        };
      }),
    );
    await use(catalog);
  },
  subscriptions: async ({ account, catalog, subscriptionDb }, use) => {
    await subscriptionDb((db) =>
      db.userSectionSubscription.createMany({
        data: catalog.sections.map((section) => ({
          userId: account.id,
          sectionId: section.id,
        })),
      }),
    );
    await use(catalog);
  },
  subscriptionRun: async (
    { page, account, semesters: _semesters, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    let closing = false;
    let operation: Promise<void> | undefined;
    try {
      await use((work) => {
        if (closing || operation)
          return Promise.reject(
            new Error("Subscription workflow is already owned or closing"),
          );
        operation = run(async () => {
          const db = isolatedWorker.database.owner;
          const request = account.request;
          const headers = {
            "x-test-storage-secret": "local-test-storage-observer",
          };
          const probeId = crypto.randomUUID();
          const producerPath = `/__test/community-effects?id=${probeId}`;
          const consumerPath = `/__test/calendar-consumer?userId=${account.id}`;
          const pending = new Set<Promise<void>>();
          const errors: unknown[] = [];
          const mutations: unknown[] = [];
          let accepting = true;
          let registered = false;
          let expectedMessages = 0;
          const subscriptions = () =>
            db.userSectionSubscription.findMany({
              where: { userId: account.id },
              orderBy: { sectionId: "asc" },
            });
          const settleEffects = async () => {
            let snapshot:
              | { effects: Effects; observed: CalendarObservation }
              | undefined;
            await expect
              .poll(
                async () => {
                  const producer = await request.get(producerPath, { headers });
                  expect(producer.status()).toBe(200);
                  const effects: Effects = await producer.json();
                  const consumer = await request.get(consumerPath, { headers });
                  expect(consumer.status()).toBe(200);
                  const observed: CalendarObservation = await consumer.json();
                  snapshot = { effects, observed };
                  return (
                    effects.messages.length >= expectedMessages &&
                    observed.attempts.length >= expectedMessages &&
                    observed.attempts.every((attempt) => attempt.complete)
                  );
                },
                {
                  timeout: 15_000,
                  message: "Native subscription calendar consumers complete",
                },
              )
              .toBe(true);
            if (!snapshot)
              throw new Error("Missing subscription calendar observations");
            const { effects, observed } = snapshot;
            expect(effects.backgroundErrors).toEqual([]);
            expect(
              effects.purges.every((purge) => purge.outcome === "fulfilled"),
            ).toBe(true);
            expect(effects.messages).toEqual(
              Array.from({ length: expectedMessages }, () => ({
                outcome: "fulfilled",
                value: { type: "user", userId: account.id },
              })),
            );
            expect(observed.attempts).toHaveLength(expectedMessages);
            expect(
              new Set(observed.attempts.map((attempt) => attempt.id)).size,
            ).toBe(expectedMessages);
            for (const attempt of observed.attempts)
              expect(attempt).toMatchObject({
                attempts: 1,
                userId: account.id,
                ackCalls: 1,
                retryCalls: 0,
                complete: true,
                errors: [],
                calendar: expect.any(String),
              });
            if (expectedMessages) {
              expect(
                observed.attempts.some(
                  (attempt) => attempt.calendar === observed.calendar,
                ),
              ).toBe(true);
              if (!observed.calendar)
                throw new Error("Native consumer did not store its export");
              const calendar = JSON.parse(observed.calendar);
              expect(calendar).toMatchObject({
                version: 2,
                text: expect.any(String),
              });
              expect(calendar.text).toContain("BEGIN:VCALENDAR");
            }
            // Reading the workspace can mint a feed token and asynchronously
            // write its audit. Observe the actual row, not just queue admission.
            const actor = await db.user.findUniqueOrThrow({
              where: { id: account.id },
            });
            let tokenAudits: unknown[] = [];
            if (actor.calendarFeedToken) {
              const readAudits = () =>
                db.auditLog.findMany({
                  where: {
                    userId: account.id,
                    action: "account_calendar_token_create",
                  },
                  select: {
                    action: true,
                    channel: true,
                    outcome: true,
                    targetId: true,
                    targetType: true,
                    userId: true,
                    subjectUserId: true,
                  },
                });
              await expect
                .poll(async () => (await readAudits()).length, {
                  timeout: 15_000,
                  message: "Actual calendar token audit is persisted",
                })
                .toBe(1);
              tokenAudits = await readAudits();
              expect(tokenAudits).toEqual([
                {
                  action: "account_calendar_token_create",
                  channel: "system",
                  outcome: "success",
                  targetId: account.id,
                  targetType: "calendar_feed",
                  userId: account.id,
                  subjectUserId: account.id,
                },
              ]);
            }
            return {
              expectedMessages,
              effects,
              observed,
              tokenAudits,
              mutations,
            };
          };
          try {
            expect((await request.get(producerPath)).status()).toBe(404);
            expect((await request.get(consumerPath)).status()).toBe(404);
            expect(
              (await request.post(producerPath, { headers })).status(),
            ).toBe(201);
            expect(
              (await request.post(consumerPath, { headers })).status(),
            ).toBe(201);
            registered = true;
            await page.route(
              (url) =>
                url.origin === isolatedWorker.origin &&
                (url.pathname.startsWith("/workspace/subscriptions") ||
                  url.pathname.startsWith("/api/workspace/subscriptions") ||
                  url.pathname === "/api/catalog/sections"),
              async (route) => {
                let fulfilled = false;
                const completion = (async () => {
                  try {
                    if (!accepting)
                      throw new Error(
                        "Subscription request started during teardown",
                      );
                    const incoming = route.request();
                    const url = new URL(incoming.url());
                    const mutation =
                      url.pathname === "/api/workspace/subscriptions/batch";
                    const before = mutation ? await subscriptions() : [];
                    const input = mutation
                      ? (incoming.postDataJSON() as {
                          action: "add" | "remove";
                          sectionIds: number[];
                        })
                      : undefined;
                    if (input) {
                      expect(incoming.method()).toBe("POST");
                      expect(Object.keys(input).sort()).toEqual([
                        "action",
                        "sectionIds",
                      ]);
                      expect(["add", "remove"]).toContain(input.action);
                      expect(input.sectionIds.length).toBeGreaterThan(0);
                      expect(new Set(input.sectionIds).size).toBe(
                        input.sectionIds.length,
                      );
                      expect(
                        await db.section.count({
                          where: { id: { in: input.sectionIds } },
                        }),
                      ).toBe(input.sectionIds.length);
                      expectedMessages++;
                    }
                    const response = await route.fetch({
                      maxRedirects: 0,
                      headers: {
                        ...incoming.headers(),
                        ...headers,
                        "x-test-community-probe": probeId,
                      },
                    });
                    const text = await response.text();
                    // Release the real response before asynchronous consumers settle.
                    // The complete workflow still joins observations before page teardown.
                    await route.fulfill({ response });
                    fulfilled = true;
                    expect([200, 303, 308]).toContain(response.status());
                    if (input) {
                      expect(response.status()).toBe(200);
                      const body = JSON.parse(text);
                      const priorIds = before.map((row) => row.sectionId);
                      const selected = new Set(input.sectionIds);
                      const expectedIds =
                        input.action === "add"
                          ? [
                              ...new Set([...priorIds, ...input.sectionIds]),
                            ].sort((a, b) => a - b)
                          : priorIds.filter((id) => !selected.has(id));
                      const changed =
                        input.action === "add"
                          ? input.sectionIds.filter(
                              (id) => !priorIds.includes(id),
                            ).length
                          : priorIds.filter((id) => selected.has(id)).length;
                      expect(body).toMatchObject({
                        semester: null,
                        matchedCodes: [],
                        unmatchedCodes: [],
                        suggestions: {},
                        matchedSectionIds: input.sectionIds,
                        unmatchedSectionIds: [],
                        action: input.action,
                        total: input.sectionIds.length,
                        addedCount: input.action === "add" ? changed : 0,
                        removedCount: input.action === "remove" ? changed : 0,
                        unchangedCount: input.sectionIds.length - changed,
                        subscription: { userId: account.id },
                      });
                      expect(
                        body.sections
                          .map((section: { id: number }) => section.id)
                          .sort((a: number, b: number) => a - b),
                      ).toEqual([...input.sectionIds].sort((a, b) => a - b));
                      expect(
                        body.subscription.sections
                          .map((section: { id: number }) => section.id)
                          .sort((a: number, b: number) => a - b),
                      ).toEqual(expectedIds);
                      const stored = await subscriptions();
                      expect(stored.map((row) => row.sectionId)).toEqual(
                        expectedIds,
                      );
                      for (const row of stored) {
                        const prior = before.find(
                          (item) => item.sectionId === row.sectionId,
                        );
                        if (prior) expect(row).toEqual(prior);
                        else
                          expect(row).toMatchObject({
                            userId: account.id,
                            kind: "regular",
                            createdAt: expect.any(Date),
                          });
                      }
                      mutations.push({
                        input,
                        status: response.status(),
                        body,
                        stored,
                      });
                    }
                  } catch (error) {
                    errors.push(error);
                    if (!fulfilled)
                      try {
                        await route.abort("aborted");
                      } catch (abortError) {
                        errors.push(abortError);
                      }
                  }
                })();
                pending.add(completion);
                try {
                  await completion;
                } finally {
                  pending.delete(completion);
                }
              },
            );
            // Only Google's exact analytics script is outside these business tests.
            await page.route(
              (url) =>
                url.href ===
                "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R",
              (route) =>
                route.fulfill({
                  status: 200,
                  contentType: "application/javascript",
                  body: "",
                }),
            );
            await page.context().addCookies([
              account.cookie,
              {
                name: "NEXT_LOCALE",
                value: "zh-cn",
                url: isolatedWorker.origin,
                sameSite: "Lax",
              },
            ]);
            await work();
          } catch (error) {
            errors.push(error);
          } finally {
            accepting = false;
            while (pending.size) await Promise.all(pending);
            if (registered)
              try {
                await testInfo.attach("subscription-effects", {
                  body: JSON.stringify(await settleEffects(), null, 2),
                  contentType: "application/json",
                });
              } catch (error) {
                errors.push(error);
              }
            try {
              await page.close();
            } catch (error) {
              errors.push(error);
            }
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Owned subscription workflow failed",
            );
        });
        return operation;
      });
    } finally {
      closing = true;
      await operation;
    }
  },
});
