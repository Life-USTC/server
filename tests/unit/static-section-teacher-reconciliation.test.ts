import { describe, expect, it, vi } from "vitest";
import { reconcileSectionTeacherRows } from "@/static-loader/section-teacher-reconciliation";

describe("static SectionTeacher reconciliation", () => {
  it("retires prior explicit rows when the current relationship set is empty", async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(0);
    const tx = {
      $executeRawUnsafe: executeRawUnsafe,
      sectionTeacher: {
        createMany: vi.fn(),
      },
    };

    await reconcileSectionTeacherRows(tx as never, [], [11]);

    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(executeRawUnsafe.mock.calls[0]?.[0]).toContain(
      'DELETE FROM "_SectionTeachers"',
    );
    expect(executeRawUnsafe.mock.calls[1]?.[0]).toContain(
      'UPDATE "SectionTeacher" SET "retiredAt"',
    );
  });
});
