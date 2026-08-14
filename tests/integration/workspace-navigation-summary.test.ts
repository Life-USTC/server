import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getDashboardNavStats } from "@/features/dashboard/server/dashboard-nav-stats";
import { getDashboardSemesters } from "@/features/dashboard/server/dashboard-overview-data";
import { getDashboardUserContext } from "@/features/dashboard/server/dashboard-user-context";
import { getWorkspaceNavigationSummary } from "@/features/dashboard/server/workspace-navigation-summary";
import { DEV_SEED_ANCHOR } from "../fixtures/dev-seed";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

describe("workspace navigation summary", () => {
  let testPrisma: TestPrismaClient;

  beforeAll(() => {
    testPrisma = createTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma(testPrisma);
  });

  test("matches the existing workspace SSR navigation semantics", async () => {
    const subscription =
      await testPrisma.userSectionSubscription.findFirstOrThrow({
        orderBy: { userId: "asc" },
        select: { userId: true },
      });
    const referenceDate = new Date(DEV_SEED_ANCHOR.recommendedAtTime);
    const context = await getDashboardUserContext(subscription.userId);
    expect(context).not.toBeNull();
    if (!context) return;

    const semesters = await getDashboardSemesters();
    const [existing, summary] = await Promise.all([
      getDashboardNavStats(
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
      calendarItemsCount: existing.calendarItemsCount,
      examsCount: existing.examsCount,
      pendingHomeworksCount: existing.pendingHomeworksCount,
      pendingTodosCount: existing.pendingTodosCount,
      subscribedSectionCount: context.sectionIds.length,
    });
  });
});
