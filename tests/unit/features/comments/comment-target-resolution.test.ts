import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  courseFindUniqueMock,
  homeworkFindUniqueMock,
  youngEventFindUniqueMock,
  sectionFindUniqueMock,
  sectionTeacherFindFirstMock,
  teacherFindUniqueMock,
  writeCommentsStageAnalyticsMock,
} = vi.hoisted(() => ({
  courseFindUniqueMock: vi.fn(),
  homeworkFindUniqueMock: vi.fn(),
  youngEventFindUniqueMock: vi.fn(),
  sectionFindUniqueMock: vi.fn(),
  sectionTeacherFindFirstMock: vi.fn(),
  teacherFindUniqueMock: vi.fn(),
  writeCommentsStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findUnique: courseFindUniqueMock },
    homework: { findUnique: homeworkFindUniqueMock },
    youngEvent: { findUnique: youngEventFindUniqueMock },
    section: { findUnique: sectionFindUniqueMock },
    sectionTeacher: { findFirst: sectionTeacherFindFirstMock },
    teacher: { findUnique: teacherFindUniqueMock },
  },
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeCommentsStageAnalytics: writeCommentsStageAnalyticsMock,
}));

describe("comment list target resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeCommentsStageAnalyticsMock.mockReset();
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
    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dbContext: "none",
        dbLabel: "app",
        dbQueryCount: 1,
        dbTransactionCount: 0,
        outcome: "success",
        stage: "target.resolve",
      }),
    );

    if (!resolved.ok) throw new Error("target should resolve");
    await commentListTargetPayload("section", resolved.target);
    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
    expect(writeCommentsStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dbContext: "none",
        dbLabel: "app",
        dbQueryCount: 0,
        dbTransactionCount: 0,
        outcome: "success",
        stage: "target.payload",
      }),
    );
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

  it("resolves young-event comments by public youngId and includes metadata", async () => {
    youngEventFindUniqueMock.mockResolvedValue({
      id: 42,
      name: "Volunteer orientation",
      youngId: "young-42",
    });

    const { resolveCommentTargetReference } = await import(
      "@/features/comments/server/comment-target-resolution"
    );
    const { commentListTargetPayload } = await import(
      "@/features/comments/server/comment-target-payload"
    );

    const resolved = await resolveCommentTargetReference({
      includeTargetMetadata: true,
      targetType: "young-event",
      youngId: " young-42 ",
      verifyExistence: true,
    });

    expect(resolved).toMatchObject({
      ok: true,
      target: {
        targetId: 42,
        youngEventId: 42,
        youngId: "young-42",
        whereTarget: { youngEventId: 42 },
        targetMetadata: {
          youngEvent: { name: "Volunteer orientation", youngId: "young-42" },
        },
      },
    });
    expect(youngEventFindUniqueMock).toHaveBeenCalledWith({
      where: { youngId: "young-42" },
      select: { id: true, name: true, youngId: true },
    });

    if (!resolved.ok) throw new Error("target should resolve");
    await expect(
      commentListTargetPayload("young-event", resolved.target),
    ).resolves.toMatchObject({
      type: "young-event",
      targetId: 42,
      youngEventId: 42,
      youngEventName: "Volunteer orientation",
      youngId: "young-42",
    });
  });

  it("rejects young-event targetId without a public youngId", async () => {
    const { resolveCommentTargetReference } = await import(
      "@/features/comments/server/comment-target-resolution"
    );

    await expect(
      resolveCommentTargetReference({
        includeTargetMetadata: true,
        rawTargetId: "42",
        targetType: "young-event",
        verifyExistence: true,
      }),
    ).resolves.toEqual({
      error: "invalid_target",
      ok: false,
      targetId: undefined,
      targetType: "young-event",
    });
    expect(youngEventFindUniqueMock).not.toHaveBeenCalled();
  });
});
