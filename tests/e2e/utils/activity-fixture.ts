import { expect } from "@playwright/test";
import type { YoungEvent } from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

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

export const test = workerTest.extend<{
  account: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  activityDb: <T>(work: (db: TestPrismaClient) => Promise<T>) => Promise<T>;
  activityRun: (work: () => Promise<void>) => Promise<void>;
  activity: YoungEvent;
  activityConsumer: {
    organizerId: string;
    organizerName: string;
    notificationTitle: string;
  };
}>({
  account: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  activityDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  activity: async ({ activityDb }, use) => {
    await use(
      await activityDb((db) =>
        db.youngEvent.create({
          data: {
            youngId: `isolated-activity-${crypto.randomUUID()}`,
            name: "Browser activity subscription",
            isActive: true,
            rawJson: {},
            startAt: new Date(Date.now() + 3_600_000),
            endAt: new Date(Date.now() + 7_200_000),
          },
        }),
      ),
    );
  },
  activityConsumer: async ({ account, activity, activityDb }, use) => {
    const organizerId = `activity-organizer-${crypto.randomUUID()}`;
    const organizerName = "Independent activity organizer";
    const notificationTitle = "Independent activity reminder";
    await activityDb((db) =>
      db.$transaction([
        db.youngOrganizer.create({
          data: {
            id: organizerId,
            name: organizerName,
            normalizedName: organizerId,
          },
        }),
        db.userYoungOrganizerSubscription.create({
          data: { userId: account.id, organizerId },
        }),
        db.userYoungEventSubscription.create({
          data: {
            userId: account.id,
            youngId: activity.youngId,
            observedState: "{}",
            remindSignup: true,
            remindDeadline: false,
            remindStart: true,
          },
        }),
        db.youngNotification.create({
          data: {
            userId: account.id,
            youngId: activity.youngId,
            kind: "event_changed",
            title: notificationTitle,
            body: "Activity details changed",
            dedupeKey: activity.youngId,
          },
        }),
      ]),
    );
    await use({ organizerId, organizerName, notificationTitle });
  },
  // Depend on page and join the complete body before native page teardown,
  // including Node assertions after a delayed browser response.
  activityRun: async (
    { page, account, activity, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) => {
        return workflow.run(() =>
          run(async () => {
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
            const commentAudits: unknown[] = [];
            let accepting = true;
            let registered = false;
            let expectedMessages = 0;
            let observedRefresh = false;
            const subscription = () =>
              db.userYoungEventSubscription.findUnique({
                where: {
                  userId_youngId: {
                    userId: account.id,
                    youngId: activity.youngId,
                  },
                },
              });
            // Explicit fixture expectation, independent of youngEventState().
            const expectedObservedState = JSON.stringify([
              activity.name,
              null,
              null,
              null,
              false,
              activity.startAt?.toISOString(),
              activity.endAt?.toISOString(),
              null,
              null,
            ]);
            const settleEffects = async () => {
              let snapshot:
                | { effects: Effects; observed: CalendarObservation }
                | undefined;
              await expect
                .poll(
                  async () => {
                    const produced = await request.get(producerPath, {
                      headers,
                    });
                    expect(produced.status()).toBe(200);
                    const effects: Effects = await produced.json();
                    const consumed = await request.get(consumerPath, {
                      headers,
                    });
                    expect(consumed.status()).toBe(200);
                    const observed: CalendarObservation = await consumed.json();
                    snapshot = { effects, observed };
                    return (
                      effects.messages.length >= expectedMessages &&
                      observed.attempts.length >= expectedMessages &&
                      observed.attempts.every((attempt) => attempt.complete)
                    );
                  },
                  {
                    timeout: 15_000,
                    message: "Real calendar consumers settle",
                  },
                )
                .toBe(true);
              if (!snapshot) throw new Error("Missing calendar observations");
              const { effects, observed } = snapshot;
              expect(effects.backgroundErrors).toEqual([]);
              for (const purge of effects.purges)
                expect(purge.outcome).toBe("fulfilled");
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
              if (!expectedMessages) {
                expect(observed.calendar).toBeNull();
                return { expectedMessages, effects, observed };
              }
              expect(
                observed.attempts.some(
                  (attempt) => attempt.calendar === observed.calendar,
                ),
              ).toBe(true);
              if (!observed.calendar)
                throw new Error("Consumer did not persist its calendar");
              const calendar = JSON.parse(observed.calendar);
              expect(calendar).toMatchObject({
                version: 2,
                text: expect.any(String),
              });
              const text = calendar.text.replace(/\r?\n[ \t]/g, "");
              expect(text).toContain("BEGIN:VCALENDAR");
              // The source row is independently arranged or verified against the
              // real mutation below. Read KV directly; a feed GET can rebuild it.
              if (await subscription()) {
                expect(text).toContain(
                  `UID:young-${activity.youngId}@life-ustc`,
                );
                expect(text).toContain(`SUMMARY:${activity.name}`);
              } else
                expect(text).not.toContain(
                  `UID:young-${activity.youngId}@life-ustc`,
                );
              return { expectedMessages, effects, observed };
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
                  (url.pathname.startsWith(
                    "/workspace/subscriptions/activities",
                  ) ||
                    url.pathname.startsWith("/catalog/young-events/") ||
                    url.pathname.startsWith("/api/workspace/young-") ||
                    url.pathname === "/api/community/comments"),
                async (route) => {
                  const completion = (async () => {
                    try {
                      if (!accepting)
                        throw new Error(
                          "Activity request started during teardown",
                        );
                      const incoming = route.request();
                      const url = new URL(incoming.url());
                      const refresh =
                        incoming.method() === "GET" &&
                        (url.pathname ===
                          "/api/workspace/young-notifications" ||
                          (url.pathname.startsWith(
                            "/workspace/subscriptions/activities",
                          ) &&
                            url.searchParams.get("view") === "notifications"));
                      const before = refresh ? await subscription() : null;
                      if (before?.observedState === "{}" && !observedRefresh) {
                        observedRefresh = true;
                        expectedMessages++;
                      }
                      const writesSubscription =
                        incoming.method() === "PUT" &&
                        url.pathname ===
                          `/api/workspace/young-event-subscriptions/${activity.youngId}`;
                      if (writesSubscription) expectedMessages++;
                      const response = await route.fetch({
                        maxRedirects: 0,
                        headers: {
                          ...incoming.headers(),
                          ...headers,
                          "x-test-community-probe": probeId,
                        },
                      });
                      try {
                        const text = await response.text();
                        if (incoming.method() === "GET") {
                          expect([200, 303]).toContain(response.status());
                          if (refresh && before) {
                            expect(await subscription()).toMatchObject({
                              observedState: expectedObservedState,
                              observedRevision:
                                before.observedState === "{}"
                                  ? 1
                                  : before.observedRevision,
                            });
                            if (before.observedState === "{}")
                              expect(
                                await db.youngNotification.findUnique({
                                  where: {
                                    userId_dedupeKey: {
                                      userId: account.id,
                                      dedupeKey: `${before.id}:change:1`,
                                    },
                                  },
                                }),
                              ).toMatchObject({
                                youngId: activity.youngId,
                                kind: "event_changed",
                                title: activity.name,
                                readAt: null,
                              });
                          }
                        } else if (writesSubscription) {
                          expect(response.status()).toBe(200);
                          const input = incoming.postDataJSON();
                          expect(JSON.parse(text)).toEqual({
                            youngId: activity.youngId,
                            subscribed: input.subscribed,
                            remindSignup:
                              input.subscribed && input.remindSignup,
                            remindDeadline:
                              input.subscribed && input.remindDeadline,
                            remindStart: input.subscribed && input.remindStart,
                          });
                          const row = await subscription();
                          if (input.subscribed)
                            expect(row).toMatchObject({
                              userId: account.id,
                              youngId: activity.youngId,
                              remindSignup: input.remindSignup,
                              remindDeadline: input.remindDeadline,
                              remindStart: input.remindStart,
                              observedState: expectedObservedState,
                            });
                          else {
                            expect(row).toBeNull();
                            expect(
                              await db.youngNotification.count({
                                where: {
                                  userId: account.id,
                                  youngId: activity.youngId,
                                  readAt: null,
                                },
                              }),
                            ).toBe(0);
                          }
                        } else if (url.pathname.endsWith("/read")) {
                          expect(response.status()).toBe(200);
                          const id = decodeURIComponent(
                            url.pathname.split("/").at(-2) ?? "",
                          );
                          expect(JSON.parse(text)).toEqual({
                            id,
                            success: true,
                          });
                          expect(
                            await db.youngNotification.findUnique({
                              where: { id },
                            }),
                          ).toMatchObject({
                            userId: account.id,
                            readAt: expect.any(Date),
                          });
                        } else if (
                          incoming.method() === "POST" &&
                          url.pathname === "/api/community/comments"
                        ) {
                          expect(response.status()).toBe(201);
                          const input = incoming.postDataJSON();
                          expect(input).toMatchObject({
                            targetType: "young-event",
                            youngId: activity.youngId,
                          });
                          const id = JSON.parse(text).id;
                          expect(
                            await db.comment.findUnique({
                              where: { id },
                            }),
                          ).toMatchObject({
                            userId: account.id,
                            youngEventId: activity.id,
                            body: input.body,
                            status: "active",
                            visibility: "public",
                          });
                          // This path writes its audit in the comment transaction.
                          // Observe the actual stored row, not Worker shutdown.
                          const session = await db.session.findFirstOrThrow({
                            where: { userId: account.id },
                            select: { id: true },
                          });
                          const audits = await db.auditLog.findMany({
                            where: { targetId: id, targetType: "comment" },
                            select: {
                              action: true,
                              channel: true,
                              outcome: true,
                              targetId: true,
                              targetType: true,
                              userId: true,
                              subjectUserId: true,
                              sessionId: true,
                              oauthClientId: true,
                              oauthGrantId: true,
                            },
                          });
                          expect(audits).toEqual([
                            {
                              action: "comment_create",
                              channel: "rest",
                              outcome: "success",
                              targetId: id,
                              targetType: "comment",
                              userId: account.id,
                              subjectUserId: account.id,
                              sessionId: session.id,
                              oauthClientId: null,
                              oauthGrantId: null,
                            },
                          ]);
                          commentAudits.push(...audits);
                        } else
                          throw new Error(
                            `Unexpected activity mutation: ${incoming.method()} ${url.pathname}`,
                          );
                      } finally {
                        await settleEffects();
                      }
                      await route.fulfill({ response });
                    } catch (error) {
                      errors.push(error);
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
              // Business scenarios own their external analytics boundary; the
              // production bootstrap remains covered without executing Google JS.
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
              await page.context().addCookies([account.cookie]);
              await workflow.body(work);
            } catch (error) {
              errors.push(error);
            } finally {
              accepting = false;
              while (pending.size) await Promise.all(pending);
              if (registered) {
                try {
                  const settled = await settleEffects();
                  await testInfo.attach("activity-effects", {
                    body: JSON.stringify(
                      { ...settled, commentAudits },
                      null,
                      2,
                    ),
                    contentType: "application/json",
                  });
                } catch (error) {
                  errors.push(error);
                }
              }
              // Accepted requests, response observations, queue consumption and
              // observations settle before the page closes. The workflow owner
              // then joins the original browser callback before releasing its Worker.
              try {
                await page.close();
              } catch (error) {
                errors.push(error);
              }
            }
            if (errors.length)
              throw new AggregateError(
                errors,
                "Owned activity workflow failed",
              );
          }),
        );
      });
    });
  },
});
