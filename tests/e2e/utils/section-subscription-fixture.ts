import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import type { CalendarMessage } from "./calendar-effects";
import { withCalendarProtocol } from "./calendar-protocol-lifecycle";
import { test as workerTest } from "./owned-worker";

type Section = { id: number; jwId: number; path: string };

export const test = workerTest.extend<{
  sectionRun: (
    plan: {
      calendar: { userId: string; messages: CalendarMessage[] } | null;
      writes: {
        action: "subscribe" | "unsubscribe";
        userId: string;
        subscribedIds: number[];
      }[];
    },
    work: () => Promise<void>,
  ) => Promise<void>;
  section: Section;
  memberSection: Section & { userId: string };
}>({
  sectionRun: async (
    { page, request: observer, playwright, isolatedWorker, section, run },
    use,
    testInfo,
  ) => {
    const db = isolatedWorker.database.owner;
    await withBrowserWorkflow(page, async (workflow) => {
      await use((plan, work) =>
        workflow.run(() =>
          run(async () => {
            let index = 0;
            await withCalendarProtocol(
              {
                page,
                observer,
                isolatedWorker,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                runBody: workflow.body,
                testInfo,
                verifyBrowserWrite: async (response, request) => {
                  const expected = plan.writes[index++];
                  if (!expected)
                    throw new Error("Unexpected section subscription write");
                  const url = new URL(request.url());
                  expect(request.method()).toBe("POST");
                  expect(url.pathname).toBe(section.path);
                  expect(url.search).toBe(`?/${expected.action}`);
                  expect(response.status()).toBe(200);
                  expect(await response.json()).toEqual({
                    type: "redirect",
                    status: 303,
                    location: section.path,
                  });
                  expect(
                    await getUserSubscribedSectionIds(db, expected.userId),
                  ).toEqual(expected.subscribedIds);
                },
              },
              async (io) => {
                // Register the existing native consumer before the complete caller can
                // submit a subscription write. Its expected messages are caller data.
                if (plan.calendar)
                  await io.observeCalendar(
                    { id: plan.calendar.userId },
                    plan.calendar.messages,
                  );
                await work();
                return {
                  verifyTransport: async ({ effects, sdkRequests }) => {
                    expect(sdkRequests).toEqual([]);
                    expect(
                      effects.requests
                        .filter(
                          ({ value }) =>
                            !["GET", "HEAD"].includes(value.method),
                        )
                        .map(({ value, result }) => [
                          value.method,
                          value.path,
                          result,
                        ]),
                    ).toEqual(
                      plan.writes.map(() => ["POST", section.path, 200]),
                    );
                  },
                  verifyState: async () => {
                    expect(index).toBe(plan.writes.length);
                    const calendar = plan.calendar;
                    if (calendar) {
                      expect(
                        (
                          await db.user.findUniqueOrThrow({
                            where: { id: calendar.userId },
                          })
                        ).calendarFeedToken,
                      ).toEqual(expect.any(String));
                      expect(
                        await getUserSubscribedSectionIds(db, calendar.userId),
                      ).toEqual([]);
                    }
                    // Visiting /workspace/subscriptions mints exactly one feed token;
                    // await its real audit consumer independently of request completion.
                    await expect
                      .poll(
                        () =>
                          db.auditLog.findMany({
                            select: {
                              userId: true,
                              action: true,
                              outcome: true,
                            },
                          }),
                        { message: "Native subscription token audit persists" },
                      )
                      .toEqual(
                        calendar
                          ? [
                              {
                                userId: calendar.userId,
                                action: "account_calendar_token_create",
                                outcome: "success",
                              },
                            ]
                          : [],
                      );
                  },
                };
              },
            );
          }),
        ),
      );
    });
  },
  section: async ({ isolatedWorker, run }, use) => {
    const section = await run(() =>
      isolatedWorker.database.owner.$transaction(async (db) => {
        const semester = await db.semester.create({
          data: { jwId: 1, code: "421", nameCn: "2026年春季学期" },
        });
        const course = await db.course.create({
          data: {
            jwId: 1,
            code: "SUB1",
            nameCn: "独立订阅课程",
            nameEn: "Independent subscription course",
          },
        });
        const teacher = await db.teacher.create({
          data: {
            jwId: 1,
            nameCn: "订阅课程教师",
            nameEn: "Subscription course teacher",
          },
        });
        return db.section.create({
          data: {
            jwId: 1,
            code: "SUB1.01",
            courseId: course.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacher.id } },
          },
        });
      }),
    );
    const path = `/catalog/sections/${section.jwId}`;
    await use({ ...section, path });
  },
  memberSection: async ({ isolatedWorker, page, section, run }, use) => {
    const member = await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
      return { ...section, userId: actor.id };
    });
    await use(member);
    // The Worker owns the account and catalog until pending page writes settle,
    // then stops before its database and storage are removed.
  },
});

export async function getUserSubscribedSectionIds(
  db: TestPrismaClient,
  userId: string,
) {
  const rows = await db.userSectionSubscription.findMany({
    where: { userId },
    select: { sectionId: true },
    orderBy: { sectionId: "asc" },
  });
  return rows.map((row) => row.sectionId);
}
