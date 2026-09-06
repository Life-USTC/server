import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadSignedWorkspacePageData } from "@/features/workspace/server/workspace-page-load-signed";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

describe("signed workspace independent RLS contexts", () => {
  let testPrisma: TestPrismaClient;

  beforeAll(() => {
    testPrisma = createTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma(testPrisma);
  });

  it("keeps overview and calendar data semantics across short RLS reads", async () => {
    const subscription =
      await testPrisma.userSectionSubscription.findFirstOrThrow({
        orderBy: { userId: "asc" },
        select: { userId: true },
      });

    const data = await loadSignedWorkspacePageData({
      calendarSemesterId: undefined,
      locale: "en-us",
      overviewWeek: null,
      pageCopy: {} as never,
      referenceNow: new Date("2026-04-29T08:00:00.000+08:00"),
      requestId: "integration-workspace-rls-reuse",
      tab: "overview",
      userId: subscription.userId,
    });

    expect(data).toMatchObject({
      signedIn: true,
      tab: "overview",
    });
    expect("userMissing" in data).toBe(false);
    expect(data.navStats).toBeDefined();
    expect(data.overview).toBeDefined();
    expect(data.overview?.calendar).not.toHaveProperty("semesterWeeks");
    expect(data.overview?.calendar).not.toHaveProperty("semesterStart");
    expect(data.overview?.calendar).not.toHaveProperty(
      "calendarSemesterNavList",
    );

    const calendarData = await loadSignedWorkspacePageData({
      calendarSemesterId: undefined,
      locale: "en-us",
      overviewWeek: null,
      pageCopy: {} as never,
      referenceNow: new Date("2026-04-29T08:00:00.000+08:00"),
      requestId: "integration-workspace-calendar-rls-reuse",
      tab: "calendar",
      userId: subscription.userId,
    });

    expect(calendarData.overview?.calendar).toHaveProperty("semesterWeeks");
    expect(calendarData.overview?.calendar).toHaveProperty("semesterStart");
    expect(calendarData.overview?.calendar).toHaveProperty(
      "calendarSemesterNavList",
    );
  });
});
