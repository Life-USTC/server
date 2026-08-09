import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadSignedDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-signed";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

describe("signed dashboard localized RLS context", () => {
  let testPrisma: TestPrismaClient;

  beforeAll(() => {
    testPrisma = createTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma(testPrisma);
  });

  it("loads the complete overview through one reusable localized transaction", async () => {
    const subscription =
      await testPrisma.userSectionSubscription.findFirstOrThrow({
        orderBy: { userId: "asc" },
        select: { userId: true },
      });

    const data = await loadSignedDashboardPageData({
      calendarSemesterId: undefined,
      locale: "en-us",
      overviewWeek: null,
      pageCopy: {} as never,
      referenceNow: new Date("2026-04-29T08:00:00.000+08:00"),
      requestId: "integration-dashboard-rls-reuse",
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
  });
});
