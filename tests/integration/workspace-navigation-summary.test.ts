import { afterAll, beforeAll, describe, expect, test } from "vitest";
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
