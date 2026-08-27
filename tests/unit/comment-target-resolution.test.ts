import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  courseFindUniqueMock,
  homeworkFindUniqueMock,
  sectionFindUniqueMock,
  sectionTeacherFindFirstMock,
  teacherFindUniqueMock,
} = vi.hoisted(() => ({
  courseFindUniqueMock: vi.fn(),
  homeworkFindUniqueMock: vi.fn(),
  sectionFindUniqueMock: vi.fn(),
  sectionTeacherFindFirstMock: vi.fn(),
  teacherFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: courseFindUniqueMock },
    homework: { findUnique: homeworkFindUniqueMock },
    section: { findUnique: sectionFindUniqueMock },
    sectionTeacher: { findFirst: sectionTeacherFindFirstMock },
    teacher: { findUnique: teacherFindUniqueMock },
  },
}));

describe("comment list target resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects direct section metadata as part of the existence read", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      code: "CS101",
      course: { jwId: 1001, nameCn: "Algorithms" },
      id: 7,
      jwId: 2001,
    });

    const { resolveCommentTargetReference } = await import(
      "@/features/comments/server/comment-target-resolution"
    );
    const { commentListTargetPayload } = await import(
      "@/features/comments/server/comment-target-payload"
    );

    const resolved = await resolveCommentTargetReference({
      includeTargetMetadata: true,
      rawTargetId: "7",
      targetType: "section",
      verifyExistence: true,
    });

    expect(resolved).toMatchObject({
      ok: true,
      target: {
        sectionId: null,
        targetId: 7,
        targetMetadata: {
          section: {
            code: "CS101",
            course: { jwId: 1001, nameCn: "Algorithms" },
            jwId: 2001,
          },
        },
      },
    });
    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();

    if (!resolved.ok) throw new Error("target should resolve");
    await commentListTargetPayload("section", resolved.target);
    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
  });

  it("resolves a section-teacher JW reference with one section read", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      code: "CS101",
      course: { jwId: 1001, nameCn: "Algorithms" },
      id: 7,
      jwId: 2001,
      sectionTeachers: [{ id: 31 }],
      teachers: [{ id: 11, nameCn: "Teacher" }],
    });

    const { resolveCommentTargetReference } = await import(
      "@/features/comments/server/comment-target-resolution"
    );

    const resolved = await resolveCommentTargetReference({
      includeTargetMetadata: true,
      sectionJwId: "2001",
      targetType: "section-teacher",
      teacherId: "11",
      verifyExistence: true,
    });

    expect(resolved).toMatchObject({
      ok: true,
      target: {
        sectionId: 7,
        sectionTeacherId: 31,
        teacherId: 11,
        targetId: null,
        targetMetadata: {
          sectionTeacher: {
            sectionId: 7,
            teacherId: 11,
            teacher: { nameCn: "Teacher" },
          },
        },
      },
    });
    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
    expect(sectionTeacherFindFirstMock).not.toHaveBeenCalled();
  });

  it("does not fall through from an invalid direct section-teacher id", async () => {
    const { resolveCommentTargetReference } = await import(
      "@/features/comments/server/comment-target-resolution"
    );

    await expect(
      resolveCommentTargetReference({
        includeTargetMetadata: true,
        rawTargetId: "not-an-id",
        sectionJwId: "2001",
        targetType: "section-teacher",
        teacherId: "11",
        verifyExistence: true,
      }),
    ).resolves.toEqual({
      error: "invalid_target",
      ok: false,
      targetId: undefined,
      targetType: "section-teacher",
    });
    expect(sectionFindUniqueMock).not.toHaveBeenCalled();
  });
});
