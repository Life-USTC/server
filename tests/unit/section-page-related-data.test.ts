import { describe, expect, it, vi } from "vitest";
import { getSectionPageRelatedData } from "@/features/section-detail/server/section-page-related-data";

describe("section page related data", () => {
  it("lists other non-retired sections for the same course", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]);

    const result = await getSectionPageRelatedData({
      prisma: { section: { findMany } } as never,
      section: {
        courseId: 10,
        id: 1,
      },
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
        where: {
          courseId: 10,
          id: { not: 1 },
          retiredAt: null,
        },
      }),
    );
    expect(result).toEqual({
      otherCourseSections: [{ id: 2 }, { id: 3 }],
    });
  });
});
