import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { listUpcomingSubscribedExamsWithCount } from "@/features/subscriptions/server/subscription-schedule-exam-read-model";
import { getWorkspaceNavStats } from "@/features/workspace/server/workspace-nav-stats";
import { getWorkspaceNavigationSummary } from "@/features/workspace/server/workspace-navigation-summary";
import { getWorkspaceSemesters } from "@/features/workspace/server/workspace-overview-data";
import { getWorkspaceUserContext } from "@/features/workspace/server/workspace-user-context";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { DEV_SEED_ANCHOR } from "../fixtures/dev-seed";
import {
  createFixturePrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

describe("workspace navigation summary", () => {
  let testPrisma: TestPrismaClient;

  beforeAll(() => {
    testPrisma = createFixturePrisma();
  });

  afterAll(async () => {
    await Promise.all([
      runtimePrisma.$disconnect(),
      disconnectTestPrisma(testPrisma),
    ]);
  });

  test("matches the existing workspace SSR navigation semantics", async () => {
    const subscription =
      await testPrisma.userSectionSubscription.findFirstOrThrow({
        orderBy: { userId: "asc" },
        select: { userId: true },
      });
    const referenceDate = new Date(DEV_SEED_ANCHOR.recommendedAtTime);
    const context = await getWorkspaceUserContext(subscription.userId);
    expect(context).not.toBeNull();
    if (!context) return;

    const semesters = await getWorkspaceSemesters();
    const [existing, summary] = await Promise.all([
      getWorkspaceNavStats(
        context.user,
        context.subscribedSections,
        referenceDate,
        undefined,
        semesters,
      ),
      getWorkspaceNavigationSummary(subscription.userId, referenceDate),
    ]);

    expect(summary).toEqual({
      userId: subscription.userId,
      unreadActivityNotificationsCount:
        existing.unreadActivityNotificationsCount,
      calendarItemsCount: existing.calendarItemsCount,
      examsCount: existing.examsCount,
      pendingHomeworksCount: existing.pendingHomeworksCount,
      pendingTodosCount: existing.pendingTodosCount,
      subscribedSectionCount: context.sectionIds.length,
    });
  });
  test("upcoming exam counts use Shanghai calendar dates across midnight and exam end boundaries", async () => {
    const marker = `exam-boundary-${crypto.randomUUID()}`;
    const base = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
    const user = await testPrisma.user.create({
      data: { name: marker, email: `${marker}@example.test` },
    });
    const course = await testPrisma.course.create({
      data: { jwId: base, code: marker, nameCn: marker },
    });
    const section = await testPrisma.section.create({
      data: { jwId: base, code: marker, courseId: course.id },
    });
    try {
      await testPrisma.userSectionSubscription.create({
        data: { userId: user.id, sectionId: section.id },
      });
      const exams: Array<{ id: number }> = [];
      for (const [index, values] of [
        {
          examDate: new Date("2026-09-27T00:00:00Z"),
          startTime: 900,
          endTime: 1000,
        },
        { examDate: null, startTime: 900, endTime: 1000 },
        {
          examDate: new Date("2026-09-28T00:00:00Z"),
          startTime: null,
          endTime: null,
        },
        {
          examDate: new Date("2026-09-28T00:00:00Z"),
          startTime: 0,
          endTime: 2359,
        },
        {
          examDate: new Date("2026-09-28T00:00:00Z"),
          startTime: 2359,
          endTime: null,
        },
        {
          examDate: new Date("2026-09-29T00:00:00Z"),
          startTime: 900,
          endTime: 1000,
        },
      ].entries())
        exams.push(
          await testPrisma.exam.create({
            data: { ...values, sectionId: section.id, jwId: base + index + 1 },
          }),
        );
      for (const [atTime, indexes] of [
        ["2026-09-28T00:00:00+08:00", [2, 3, 4, 5]],
        ["2026-09-27T23:59:00+08:00", [2, 3, 4, 5]],
        ["2026-09-28T07:59:00+08:00", [2, 3, 4, 5]],
        ["2026-09-28T08:00:00+08:00", [2, 3, 4, 5]],
        ["2026-09-28T12:00:00+08:00", [2, 3, 4, 5]],
        ["2026-09-28T23:59:00+08:00", [2, 3, 4, 5]],
        ["2026-09-29T00:00:00+08:00", [5]],
        ["2026-09-29T10:00:00+08:00", [5]],
        ["2026-09-29T10:01:00+08:00", []],
      ] as const) {
        const reference = new Date(atTime);
        const summary = await getWorkspaceNavigationSummary(user.id, reference);
        expect(summary.examsCount, atTime).toBe(indexes.length);
        const overview = await listUpcomingSubscribedExamsWithCount(user.id, {
          atTime: reference,
        });
        expect(overview.total, atTime).toBe(indexes.length);
        expect(overview.items.map(({ id }) => id).sort()).toEqual(
          indexes.map((index) => exams[index].id).sort(),
        );
      }
    } finally {
      await testPrisma.user.delete({ where: { id: user.id } });
      await testPrisma.exam.deleteMany({ where: { sectionId: section.id } });
      await testPrisma.section.delete({ where: { id: section.id } });
      await testPrisma.course.delete({ where: { id: course.id } });
    }
  });
  test("counts only the viewer's unread, unexpired reminders even without course subscriptions", async () => {
    const marker = `nav-reminders-${crypto.randomUUID()}`;
    const referenceDate = new Date("2026-09-25T00:00:00Z");
    const users = await Promise.all(
      [0, 1].map((index) =>
        testPrisma.user.create({
          data: {
            name: marker,
            username: `${marker}-${index}`,
            email: `${marker}-${index}@example.test`,
            emailVerified: true,
          },
        }),
      ),
    );
    try {
      await testPrisma.youngNotification.createMany({
        data: [
          {
            userId: users[0].id,
            dedupeKey: "unread",
            kind: "event_changed",
            title: "Visible",
            body: "Visible",
          },
          {
            userId: users[0].id,
            dedupeKey: "read",
            kind: "event_changed",
            title: "Read",
            body: "Read",
            readAt: referenceDate,
          },
          {
            userId: users[0].id,
            dedupeKey: "expired",
            kind: "event_changed",
            title: "Expired",
            body: "Expired",
            expiresAt: referenceDate,
          },
          {
            userId: users[1].id,
            dedupeKey: "other",
            kind: "event_changed",
            title: "Other",
            body: "Other",
          },
        ],
      });
      const summary = await getWorkspaceNavigationSummary(
        users[0].id,
        referenceDate,
      );
      expect(summary.unreadActivityNotificationsCount).toBe(1);
      expect(summary.subscribedSectionCount).toBe(0);
      const stats = await getWorkspaceNavStats(users[0], [], referenceDate);
      expect(stats.unreadActivityNotificationsCount).toBe(1);
    } finally {
      await testPrisma.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    }
  });
});
