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

describe("评论 section-teacher 目标", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("不将已退役的 section-teacher 行解析为活跃目标", async () => {
    prismaMock.sectionTeacher.findUnique.mockResolvedValue({
      id: 9,
      retiredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(findSectionTeacherId(1, 2)).resolves.toBeNull();
  });

  it("当活跃分配不存在时将陈旧的 section-teacher 行报告为缺失", async () => {
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

  it("仅在存在活跃分配后才重新激活显式目标", async () => {
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

  it("已退役的直接 section-teacher ID 被拒绝", async () => {
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
