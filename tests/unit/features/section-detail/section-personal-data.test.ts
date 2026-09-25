import { beforeEach, describe, expect, it, vi } from "vitest";

const { findSection, readSubscription, readHomeworks } = vi.hoisted(() => ({
  findSection: vi.fn(),
  readSubscription: vi.fn(),
  readHomeworks: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { section: { findUnique: findSection } },
}));
vi.mock("@/features/subscriptions/server/subscriptions", () => ({
  getUserSectionSubscriptionStatusForSection: readSubscription,
}));
vi.mock(
  "@/features/section-detail/server/section-detail-homework-data",
  () => ({ getSectionHomeworkData: readHomeworks }),
);

import { getSectionPersonalData } from "@/features/section-detail/server/section-personal-data";

beforeEach(() => {
  vi.clearAllMocks();
  findSection.mockResolvedValue({ id: 31 });
  readSubscription.mockResolvedValue({
    isSubscribed: true,
    calendarFeedCredential: "secret-must-not-leak",
  });
  readHomeworks.mockImplementation(
    async (
      _sectionId: number,
      userId: string | null,
      focusedHomeworkId: string | null,
    ) => ({
      viewer: { isAuthenticated: userId !== null, userId },
      homeworks: [
        {
          id: focusedHomeworkId,
          completion: userId
            ? { completedAt: "2026-09-25T12:00:00+08:00" }
            : null,
        },
      ],
      auditLogs: [],
    }),
  );
});

describe("section Web personal projection", () => {
  it("leaves subscription and completion anonymous without a session", async () => {
    const result = await getSectionPersonalData({
      jwId: 301,
      userId: null,
      focusedHomeworkId: "hw-1",
    });
    expect(readSubscription).not.toHaveBeenCalled();
    expect(readHomeworks).toHaveBeenCalledWith(31, null, "hw-1");
    expect(result?.viewer).toEqual({ signedIn: false, isSubscribed: false });
    expect(result?.homeworkData.homeworks[0]?.completion).toBeNull();
  });

  it("passes each current identity to both readers and excludes feed credentials", async () => {
    for (const userId of ["alice", "bob"]) {
      const result = await getSectionPersonalData({
        jwId: 301,
        userId,
        focusedHomeworkId: "hw-1",
      });
      expect(readSubscription).toHaveBeenLastCalledWith(userId, 301);
      expect(readHomeworks).toHaveBeenLastCalledWith(31, userId, "hw-1");
      expect(result?.viewer).toEqual({ signedIn: true, isSubscribed: true });
      expect(result?.homeworkData.viewer.userId).toBe(userId);
      expect(JSON.stringify(result)).not.toContain("secret-must-not-leak");
    }
  });

  it("does not query viewer state for a missing section", async () => {
    findSection.mockResolvedValue(null);
    expect(
      await getSectionPersonalData({
        jwId: 999,
        userId: "alice",
        focusedHomeworkId: null,
      }),
    ).toBeNull();
    expect(readSubscription).not.toHaveBeenCalled();
    expect(readHomeworks).not.toHaveBeenCalled();
  });
});
