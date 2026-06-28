import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";

const {
  auditLogCreateMock,
  descriptionEditCreateMock,
  descriptionFindFirstMock,
  descriptionUpdateMock,
} = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(),
  descriptionEditCreateMock: vi.fn(),
  descriptionFindFirstMock: vi.fn(),
  descriptionUpdateMock: vi.fn(),
}));

vi.mock("@/lib/metrics/observability-metrics", () => ({
  recordAuditWriteMetric: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isPrismaUniqueConstraintError: vi.fn(),
}));

function transactionClient() {
  return {
    auditLog: {
      create: auditLogCreateMock,
    },
    description: {
      findFirst: descriptionFindFirstMock,
      update: descriptionUpdateMock,
    },
    descriptionEdit: {
      create: descriptionEditCreateMock,
    },
  } as unknown as Prisma.TransactionClient;
}

describe("updateHomeworkDescription", () => {
  beforeEach(() => {
    auditLogCreateMock.mockReset();
    descriptionEditCreateMock.mockReset();
    descriptionFindFirstMock.mockReset();
    descriptionUpdateMock.mockReset();

    auditLogCreateMock.mockResolvedValue({});
    descriptionEditCreateMock.mockResolvedValue({});
  });

  it("为作业描述更新写入描述历史与审计记录", async () => {
    descriptionFindFirstMock.mockResolvedValue({
      id: "description-1",
      content: "old content",
    });
    descriptionUpdateMock.mockResolvedValue({
      id: "description-1",
      content: "new content",
    });
    const { updateHomeworkDescription } = await import(
      "@/features/homeworks/server/homework-description"
    );

    await updateHomeworkDescription(transactionClient(), {
      description: " new content ",
      homeworkId: "homework-1",
      userId: "user-1",
    });

    expect(descriptionUpdateMock).toHaveBeenCalledWith({
      where: { id: "description-1" },
      data: {
        content: "new content",
        lastEditedAt: expect.any(Date),
        lastEditedById: "user-1",
      },
    });
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
          content: "new content",
          targetType: "homework",
        },
        targetId: "description-1",
        targetType: "description",
        userId: "user-1",
      }),
    });
  });
});
