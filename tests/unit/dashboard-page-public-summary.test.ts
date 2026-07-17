import { describe, expect, it, vi } from "vitest";
import { loadDashboardPublicSummary } from "@/features/dashboard/server/dashboard-page-public-summary";

vi.mock("@/features/dashboard-links/server/dashboard-link-data", () => ({
  getPublicDashboardLinksData: () => ({
    dashboardLinks: [],
    overviewLinks: [],
  }),
}));

describe("dashboard public summary", () => {
  it("counts only active Sections", async () => {
    const sectionCount = vi.fn().mockResolvedValue(11);
    const prisma = {
      course: { count: vi.fn().mockResolvedValue(7) },
      section: { count: sectionCount },
      semester: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const summary = await loadDashboardPublicSummary(
      prisma as never,
      new Date("2026-07-18T00:00:00.000Z"),
    );

    expect(sectionCount).toHaveBeenCalledOnce();
    expect(sectionCount).toHaveBeenCalledWith({
      where: { retiredAt: null },
    });
    expect(summary.counts.sections).toBe(11);
  });
});
