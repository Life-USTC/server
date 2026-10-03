import type { ExpectStatic } from "vitest";
import type { TestPrismaClient } from "../../../shared/prisma";

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

function metadataMatches(metadata: unknown, expected: Record<string, unknown>) {
  if (typeof metadata !== "object" || metadata === null) return false;
  const record = metadata as Record<string, unknown>;
  return Object.entries(expected).every(
    ([key, value]) => record[key] === value,
  );
}

export async function findCommentAuditLog(
  prisma: TestPrismaClient,
  input: {
    action:
      | "comment_create"
      | "comment_edit"
      | "comment_delete"
      | "comment_react";
    commentId: string;
    metadata: Record<string, unknown>;
    userId: string;
    expect: ExpectStatic;
  },
) {
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
