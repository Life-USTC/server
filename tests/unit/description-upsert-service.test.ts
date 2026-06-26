import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditLogCreateMock,
  descriptionCreateMock,
  descriptionEditCreateMock,
  descriptionFindFirstMock,
  descriptionUpdateMock,
  getViewerContextMock,
  isPrismaUniqueConstraintErrorMock,
  prismaMock,
  sectionFindUniqueMock,
} = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(),
  descriptionCreateMock: vi.fn(),
  descriptionEditCreateMock: vi.fn(),
  descriptionFindFirstMock: vi.fn(),
  descriptionUpdateMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  isPrismaUniqueConstraintErrorMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
    description: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    descriptionEdit: {
      create: vi.fn(),
    },
    section: {
      findUnique: vi.fn(),
    },
  },
  sectionFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isPrismaUniqueConstraintError: isPrismaUniqueConstraintErrorMock,
}));

vi.mock("@/lib/metrics/observability-metrics", () => ({
  recordAuditWriteMetric: vi.fn(),
}));

describe("upsertDescriptionContent", () => {
  beforeEach(() => {
    auditLogCreateMock.mockReset();
    descriptionCreateMock.mockReset();
    descriptionEditCreateMock.mockReset();
    descriptionFindFirstMock.mockReset();
    descriptionUpdateMock.mockReset();
    getViewerContextMock.mockReset();
    isPrismaUniqueConstraintErrorMock.mockReset();
    sectionFindUniqueMock.mockReset();

    prismaMock.auditLog.create = auditLogCreateMock;
    prismaMock.description.create = descriptionCreateMock;
    prismaMock.description.findFirst = descriptionFindFirstMock;
    prismaMock.description.update = descriptionUpdateMock;
    prismaMock.descriptionEdit.create = descriptionEditCreateMock;
    prismaMock.section.findUnique = sectionFindUniqueMock;
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (action) =>
      action({
        auditLog: prismaMock.auditLog,
        description: prismaMock.description,
        descriptionEdit: prismaMock.descriptionEdit,
      }),
    );

    auditLogCreateMock.mockResolvedValue({});
    descriptionEditCreateMock.mockResolvedValue({});
    getViewerContextMock.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
    });
    isPrismaUniqueConstraintErrorMock.mockReturnValue(false);
    sectionFindUniqueMock.mockResolvedValue({ id: 1 });
  });

  it("rejects changed content when the required audit write fails", async () => {
    const auditError = new Error("audit unavailable");
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "old content",
    });
    descriptionUpdateMock.mockResolvedValue({
      id: "description-1",
      content: "new content",
    });
    auditLogCreateMock.mockRejectedValueOnce(auditError);
    const { upsertDescriptionContent } = await import(
      "@/features/descriptions/server/description-upsert"
    );

    await expect(
      upsertDescriptionContent({
        content: "new content",
        targetId: 1,
        targetType: "section",
        userId: "user-1",
      }),
    ).rejects.toThrow(auditError);

    expect(descriptionEditCreateMock).toHaveBeenCalledWith({
      data: {
        descriptionId: "description-1",
        editorId: "user-1",
        previousContent: "old content",
        nextContent: "new content",
      },
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "description_edit",
        metadata: {
          targetType: "section",
          content: "new content",
        },
        targetId: "description-1",
        targetType: "description",
        userId: "user-1",
      }),
    });
  });

  it("does not write edit history or audit rows for idempotent content", async () => {
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "same content",
    });
    const { upsertDescriptionContent } = await import(
      "@/features/descriptions/server/description-upsert"
    );

    const result = await upsertDescriptionContent({
      content: "same content",
      targetId: 1,
      targetType: "section",
      userId: "user-1",
    });

    expect(result).toEqual({
      id: "description-1",
      ok: true,
      updated: false,
    });
    expect(descriptionEditCreateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });
});
