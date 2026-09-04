import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getWorkspaceNavStats } from "@/features/workspace/server/workspace-nav-stats";
import { getWorkspaceNavigationSummary } from "@/features/workspace/server/workspace-navigation-summary";
import { getWorkspaceSemesters } from "@/features/workspace/server/workspace-overview-data";
import { getWorkspaceUserContext } from "@/features/workspace/server/workspace-user-context";
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
      calendarItemsCount: existing.calendarItemsCount,
      examsCount: existing.examsCount,
      pendingHomeworksCount: existing.pendingHomeworksCount,
      pendingTodosCount: existing.pendingTodosCount,
      subscribedSectionCount: context.sectionIds.length,
    });
  });
});
