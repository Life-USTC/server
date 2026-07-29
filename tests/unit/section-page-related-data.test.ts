import { describe, expect, it, vi } from "vitest";
import { getSectionPageRelatedData } from "@/features/section-detail/server/section-page-related-data";

describe("section page related data", () => {
  it("bounds both related-section groups in the database query", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const result = await getSectionPageRelatedData({
      prisma: { section: { findMany } } as never,
      section: {
        courseId: 10,
        id: 1,
        semesterId: 20,
        teachers: [{ id: 30 }],
      },
    });

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({
          semesterId: 20,
          teachers: { none: { id: { in: [30] } } },
        }),
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({
          semesterId: { not: 20 },
          teachers: { some: { id: { in: [30] } } },
        }),
      }),
    );
    expect(result).toEqual({
      sameSemesterOtherTeachers: [{ id: 2 }],
      sameTeacherOtherSemesters: [{ id: 3 }],
    });
  });
});
