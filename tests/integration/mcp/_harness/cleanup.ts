import type { ExpectStatic } from "vitest";
import { prisma } from "./fixtures";

type AuditLogRow = { id: string; metadata: unknown };

async function pollForAuditLog(
  lookup: () => Promise<AuditLogRow | null | undefined>,
  expect: ExpectStatic,
) {
  let log: AuditLogRow | null = null;
  await expect
    .poll(
      async () => {
        log = (await lookup()) ?? null;
        return log;
      },
      { timeout: 500, interval: 25 },
    )
    .not.toBeNull();
  const result = await lookup();
  if (!result) {
    throw new Error("Expected an audit log before the poll deadline");
  }
  return result;
}

export async function findDescriptionEditAuditLog(
  descriptionId: string,
  userId: string,
  expect: ExpectStatic,
) {
  if (!userId) {
    throw new Error("userId is required for findDescriptionEditAuditLog");
  }

  return pollForAuditLog(
    () =>
      prisma.auditLog.findFirst({
        where: {
          action: "description_edit",
          targetId: descriptionId,
          targetType: "description",
          userId,
        },
        select: { id: true, metadata: true },
      }),
    expect,
  );
}

export function metadataMatches(
  metadata: unknown,
  expected: Record<string, unknown>,
) {
  if (typeof metadata !== "object" || metadata === null) return false;
  const record = metadata as Record<string, unknown>;
  return Object.entries(expected).every(
    ([key, value]) => record[key] === value,
  );
}

export async function findCommentAuditLog(input: {
  action:
    | "comment_create"
    | "comment_edit"
    | "comment_delete"
    | "comment_react";
  commentId: string;
  metadata: Record<string, unknown>;
  userId: string;
  expect: ExpectStatic;
}) {
  if (!input.userId) {
    throw new Error("userId is required for findCommentAuditLog");
  }

  return pollForAuditLog(async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: input.action,
        targetId: input.commentId,
        targetType: "comment",
        userId: input.userId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true },
      take: 10,
    });
    return logs.find((entry) =>
      metadataMatches(entry.metadata, input.metadata),
    );
  }, input.expect);
}

export async function findUploadDeleteAuditLog(input: {
  metadata: Record<string, unknown>;
  uploadId: string;
  userId: string;
  expect: ExpectStatic;
}) {
  if (!input.userId) {
    throw new Error("userId is required for findUploadDeleteAuditLog");
  }

  return pollForAuditLog(async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: "upload_delete",
        targetId: input.uploadId,
        targetType: "upload",
        userId: input.userId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true },
      take: 10,
    });
    return logs.find((entry) =>
      metadataMatches(entry.metadata, input.metadata),
    );
  }, input.expect);
}

export async function deleteCommentRecords(commentIds: string[]) {
  if (commentIds.length === 0) return;

  await prisma.auditLog.deleteMany({
    where: {
      targetId: { in: commentIds },
      targetType: "comment",
    },
  });
  await prisma.commentAttachment.deleteMany({
    where: { commentId: { in: commentIds } },
  });
  await prisma.comment.updateMany({
    where: { id: { in: commentIds } },
    data: { parentId: null, rootId: null },
  });
  await prisma.comment.deleteMany({
    where: { id: { in: commentIds } },
  });
}

export async function deleteIntegrationHomework(
  homeworkId: string | undefined,
) {
  if (!homeworkId) return;

  await prisma.homeworkCompletion.deleteMany({ where: { homeworkId } });
  await prisma.auditLog.deleteMany({
    where: { targetId: homeworkId, targetType: "homework" },
  });
  await prisma.descriptionEdit.deleteMany({
    where: { description: { homeworkId } },
  });
  await prisma.description.deleteMany({ where: { homeworkId } });
  await prisma.homework.deleteMany({ where: { id: homeworkId } });
}

export async function deleteIntegrationTodo(todoId: string | undefined) {
  if (!todoId) return;
  await prisma.todo.deleteMany({ where: { id: todoId } });
}

export async function deleteIntegrationExam(jwId: number | undefined) {
  if (jwId === undefined) return;
  await prisma.exam.deleteMany({ where: { jwId } });
}

export async function replaceUserSubscribedSections(
  userId: string,
  sectionIds: number[],
) {
  await prisma.$transaction([
    prisma.userSectionSubscription.deleteMany({ where: { userId } }),
    prisma.userSectionSubscription.createMany({
      data: sectionIds.map((sectionId) => ({ userId, sectionId })),
      skipDuplicates: true,
    }),
  ]);
}

/** Attempt every resource release even if an earlier release failed. */
export async function cleanupMcpResources(
  steps: Array<() => Promise<unknown>>,
) {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "MCP fixture cleanup failed");
}
