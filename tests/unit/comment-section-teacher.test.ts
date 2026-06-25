import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findSectionTeacherId,
  findSectionTeacherTarget,
  resolveSectionTeacherId,
} from "@/features/comments/server/comment-section-teacher";
import { verifyCommentTargetEntity } from "@/features/comments/server/comment-target-verification";

const prismaMock = vi.hoisted(() => ({
  section: {
    findFirst: vi.fn(),
  },
  sectionTeacher: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

describe("comment section-teacher targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not resolve retired section-teacher rows as active targets", async () => {
    prismaMock.sectionTeacher.findUnique.mockResolvedValue({
      id: 9,
      retiredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(findSectionTeacherId(1, 2)).resolves.toBeNull();
  });

  it("reports stale section-teacher rows as missing when the active assignment is gone", async () => {
    prismaMock.sectionTeacher.findUnique.mockResolvedValue({
      id: 9,
      retiredAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    prismaMock.section.findFirst.mockResolvedValue(null);

    await expect(findSectionTeacherTarget(1, 2)).resolves.toEqual({
      exists: false,
      id: null,
    });
  });

  it("reactivates an explicit target only after the active assignment exists", async () => {
    prismaMock.section.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.sectionTeacher.upsert.mockResolvedValue({ id: 9 });

    await expect(resolveSectionTeacherId(1, 2)).resolves.toBe(9);
    expect(prismaMock.sectionTeacher.upsert).toHaveBeenCalledWith({
      where: {
        sectionId_teacherId: {
          sectionId: 1,
          teacherId: 2,
        },
      },
      update: { retiredAt: null },
      create: { sectionId: 1, teacherId: 2 },
    });
  });

  it("rejects direct section-teacher ids when they are retired", async () => {
    prismaMock.sectionTeacher.findFirst.mockResolvedValue(null);

    await expect(
      verifyCommentTargetEntity("section-teacher", { sectionTeacherId: 9 }),
    ).resolves.toBe(false);
    expect(prismaMock.sectionTeacher.findFirst).toHaveBeenCalledWith({
      where: { id: 9, retiredAt: null },
      select: { id: true },
    });
  });
});
