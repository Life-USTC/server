import { expect } from "vitest";
import type { AuditAction } from "@/generated/prisma/client";
import type { TestPrismaClient } from "../../../shared/prisma";
import { isolatedMcpTest } from "../_harness/isolated-context";

const auditTest = isolatedMcpTest.extend(
  "f",
  async ({ isolatedDatabase, mcpSessions, mcpSection }) => {
    const marker = `private-body-${crypto.randomUUID()}`;
    const { user, comment } = await isolatedDatabase.owner.$transaction(
      async (db) => {
        const user = await db.user.create({
          data: {
            id: "audit-author",
            email: "audit-author@example.test",
            name: "Private audit author",
          },
        });
        const comment = await db.comment.create({
          data: {
            userId: user.id,
            sectionId: mcpSection.id,
            body: marker,
            visibility: "public",
            status: "active",
            isAnonymous: false,
          },
        });
        return { user, comment };
      },
    );
    const session = mcpSessions.own(user.id);
    await session.initialize();
    return {
      userId: user.id,
      client: session.client,
      marker,
      comment,
      section: mcpSection,
    };
  },
);

async function auditRows(
  prisma: TestPrismaClient,
  userId: string,
  action: AuditAction,
) {
  return prisma.auditLog.findMany({
    where: { userId, action },
    orderBy: { createdAt: "asc" },
  });
}
async function expectCommentAudit(
  prisma: TestPrismaClient,
  input: {
    userId: string;
    commentId: string;
    action: AuditAction;
    privateBody: string;
  },
) {
  const rows = await auditRows(prisma, input.userId, input.action);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    userId: input.userId,
    subjectUserId: input.userId,
    targetId: input.commentId,
    targetType: "comment",
    outcome: "success",
    metadata: { source: "mcp" },
  });
  expect(JSON.stringify(rows)).not.toContain(input.privateBody);
  expect(JSON.stringify(rows)).not.toContain("Private audit author");
}

auditTest("audit.action-comment-create", async ({ f, isolatedDatabase }) => {
  const prisma = isolatedDatabase.owner;
  const result = await f.client.call<{ success: boolean; id: string }>(
    "community_comment_create",
    {
      targetType: "section",
      sectionJwId: f.section.jwId,
      body: `${f.marker}-created`,
      visibility: "public",
      isAnonymous: false,
    },
  );
  expect(result.success).toBe(true);
  expect(
    await prisma.comment.findUnique({ where: { id: result.id } }),
  ).toMatchObject({ body: `${f.marker}-created`, userId: f.userId });
  await expectCommentAudit(prisma, {
    userId: f.userId,
    commentId: result.id,
    action: "comment_create",
    privateBody: f.marker,
  });
});

auditTest("audit.action-comment-edit", async ({ f, isolatedDatabase }) => {
  const prisma = isolatedDatabase.owner;
  const result = await f.client.call<{ success: boolean }>(
    "community_comment_update",
    {
      commentId: f.comment.id,
      body: `${f.marker}-updated`,
      visibility: "logged_in_only",
      isAnonymous: true,
    },
  );
  expect(result.success).toBe(true);
  expect(
    await prisma.comment.findUnique({ where: { id: f.comment.id } }),
  ).toMatchObject({
    body: `${f.marker}-updated`,
    visibility: "logged_in_only",
    isAnonymous: true,
  });
  await expectCommentAudit(prisma, {
    userId: f.userId,
    commentId: f.comment.id,
    action: "comment_edit",
    privateBody: f.marker,
  });
});

auditTest("audit.action-comment-delete", async ({ f, isolatedDatabase }) => {
  const prisma = isolatedDatabase.owner;
  expect(
    await f.client.call("community_comment_delete", {
      commentId: f.comment.id,
    }),
  ).toEqual({ success: true });
  expect(
    await prisma.comment.findUnique({ where: { id: f.comment.id } }),
  ).toMatchObject({ status: "deleted", deletedAt: expect.any(Date) });
  await expectCommentAudit(prisma, {
    userId: f.userId,
    commentId: f.comment.id,
    action: "comment_delete",
    privateBody: f.marker,
  });
});

auditTest("audit.action-comment-react", async ({ f, isolatedDatabase }) => {
  const prisma = isolatedDatabase.owner;
  for (const operation of ["add", "remove"] as const) {
    expect(
      await f.client.call(`community_comment_reaction_${operation}`, {
        commentId: f.comment.id,
        type: "heart",
      }),
    ).toEqual({ success: true, changed: true });
    expect(
      await prisma.commentReaction.count({
        where: { commentId: f.comment.id, userId: f.userId, type: "heart" },
      }),
    ).toBe(operation === "add" ? 1 : 0);
    const rows = await auditRows(prisma, f.userId, "comment_react");
    expect(rows).toHaveLength(operation === "add" ? 1 : 2);
    expect(rows.at(-1)).toMatchObject({
      userId: f.userId,
      subjectUserId: f.userId,
      targetId: f.comment.id,
      targetType: "comment",
      outcome: "success",
      metadata: { source: "mcp", type: "heart", operation },
    });
    expect(JSON.stringify(rows)).not.toContain(f.marker);
    // An unchanged retry has no committed reaction change and adds no event.
    expect(
      await f.client.call(`community_comment_reaction_${operation}`, {
        commentId: f.comment.id,
        type: "heart",
      }),
    ).toEqual({ success: true, changed: false });
    expect(await auditRows(prisma, f.userId, "comment_react")).toHaveLength(
      rows.length,
    );
  }
});

auditTest("audit.action-description-edit", async ({ f, isolatedDatabase }) => {
  const prisma = isolatedDatabase.owner;
  const teacher = await prisma.teacher.create({
    data: {
      jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
      nameCn: f.marker,
    },
  });
  const constraint = `audit_policy_${crypto.randomUUID().replaceAll("-", "")}`;
  if (!/^[a-zA-Z0-9_-]+$/.test(f.userId))
    throw new Error("Unsafe fixture identifier");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE public."AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" IS DISTINCT FROM '${f.userId}') NOT VALID`,
  );
  try {
    const failed = await f.client.callToolResult("community_description_set", {
      targetType: "teacher",
      teacherId: teacher.id,
      content: f.marker,
    });
    expect(failed.isError).toBe(true);
    expect(
      await prisma.description.count({ where: { teacherId: teacher.id } }),
    ).toBe(0);
    expect(
      await prisma.descriptionEdit.count({ where: { editorId: f.userId } }),
    ).toBe(0);
    expect(await auditRows(prisma, f.userId, "description_edit")).toHaveLength(
      0,
    );
  } finally {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public."AuditLog" DROP CONSTRAINT "${constraint}"`,
    );
  }

  const result = await f.client.call<{
    success: boolean;
    id: string;
    updated: boolean;
  }>("community_description_set", {
    targetType: "teacher",
    teacherId: teacher.id,
    content: f.marker,
  });
  expect(result).toMatchObject({ success: true, updated: true });
  expect(
    await prisma.description.findUnique({ where: { id: result.id } }),
  ).toMatchObject({ content: f.marker, lastEditedById: f.userId });
  expect(
    await prisma.descriptionEdit.findMany({
      where: { descriptionId: result.id },
    }),
  ).toEqual([
    expect.objectContaining({
      editorId: f.userId,
      previousContent: null,
      nextContent: f.marker,
    }),
  ]);
  const rows = await auditRows(prisma, f.userId, "description_edit");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    targetId: result.id,
    targetType: "description",
    userId: f.userId,
    metadata: { source: "mcp", targetType: "teacher" },
  });
  expect(JSON.stringify(rows)).not.toContain(f.marker);
  expect(
    await f.client.call("community_description_set", {
      targetType: "teacher",
      teacherId: teacher.id,
      content: f.marker,
    }),
  ).toMatchObject({ success: true, updated: false });
  expect(await auditRows(prisma, f.userId, "description_edit")).toHaveLength(1);
  expect(
    await prisma.descriptionEdit.count({
      where: { descriptionId: result.id },
    }),
  ).toBe(1);
});
