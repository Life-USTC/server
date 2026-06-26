import type {
  CommentReactionType,
  CommentVisibility,
  Prisma,
} from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/db/prisma-errors";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
import { commentThreadInclude } from "./comment-read-model";
import type { ViewerInfo } from "./comment-serialization";
import { buildCommentNodes } from "./comment-serialization";
import { resolveCommentMutationTargetReference } from "./comment-target-resolution";
import { type CommentTargetType, resolveCommentTarget } from "./comment-utils";

type CommentMutationError = "forbidden" | "locked" | "not_found" | "suspended";
type CommentMutationFailure = {
  ok: false;
  error: CommentMutationError;
  reason?: string | null;
};

type CreateCommentTarget = {
  whereTarget: Record<string, unknown>;
};

type CommentMutationAuditMetadata = {
  ipAddress?: string;
  source?: string;
  userAgent?: string;
};

type CreateCommentError =
  | "forbidden"
  | "invalid_attachments"
  | "invalid_target"
  | "locked"
  | "parent_not_found"
  | "suspended"
  | "target_mismatch"
  | "target_not_found";

export async function createComment(input: {
  attachmentIds?: string[];
  auditMetadata?: CommentMutationAuditMetadata;
  content: string;
  courseJwId?: unknown;
  homeworkId?: string;
  isAnonymous: boolean;
  parentId?: string | null;
  rawTargetId: unknown;
  sectionId?: unknown;
  sectionJwId?: unknown;
  sectionTeacherId?: unknown;
  targetType: CommentTargetType;
  teacherId?: unknown;
  userId: string;
  visibility: CommentVisibility;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const reference = await resolveCommentMutationTargetReference({
    courseJwId: input.courseJwId,
    homeworkId: input.homeworkId,
    rawTargetId: input.rawTargetId,
    sectionId: input.sectionId,
    sectionJwId: input.sectionJwId,
    sectionTeacherId: input.sectionTeacherId,
    targetType: input.targetType,
    teacherId: input.teacherId,
  });
  if (!reference.ok) {
    return {
      ok: false as const,
      error: reference.error as Extract<
        CreateCommentError,
        "invalid_target" | "target_not_found"
      >,
      targetId: reference.targetId,
      targetType: reference.targetType,
    };
  }

  const target = await resolveCommentTarget({
    createSectionTeacherTarget: true,
    rawTargetId: reference.rawTargetId,
    sectionId: reference.sectionId,
    targetType: input.targetType,
    teacherId: reference.teacherId,
    verifyExistence: true,
  });
  if (!target) {
    return {
      ok: false as const,
      error: "invalid_target" as CreateCommentError,
      targetId: input.rawTargetId,
      targetType: input.targetType,
    };
  }
  if (!target.verified) {
    return {
      ok: false as const,
      error: "target_not_found" as CreateCommentError,
      targetId: reference.rawTargetId,
      targetType: input.targetType,
    };
  }

  const attachmentIds = input.attachmentIds ?? [];
  if (
    attachmentIds.length > 0 &&
    !(await validateCommentAttachmentIds(input.userId, attachmentIds))
  ) {
    return {
      ok: false as const,
      error: "invalid_attachments" as CreateCommentError,
    };
  }

  let result: Awaited<ReturnType<typeof createCommentRecord>>;
  try {
    result = await createCommentRecord({
      attachmentIds,
      content: input.content,
      isAnonymous: input.isAnonymous,
      auditMetadata: input.auditMetadata,
      parentId: input.parentId,
      target,
      userId: input.userId,
      viewer: actor.viewer,
      visibility: input.visibility,
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    return {
      ok: false as const,
      error: "invalid_attachments" as CreateCommentError,
    };
  }
  if (!result.ok) return result;

  return { ok: true as const, comment: result.comment };
}

async function createCommentRecord({
  attachmentIds,
  auditMetadata,
  content,
  isAnonymous,
  parentId,
  target,
  userId,
  viewer,
  visibility,
}: {
  attachmentIds: string[];
  auditMetadata?: CommentMutationAuditMetadata;
  content: string;
  isAnonymous: boolean;
  parentId?: string | null;
  target: CreateCommentTarget;
  userId: string;
  viewer: ViewerInfo;
  visibility: CommentVisibility;
}) {
  return prisma.$transaction(async (tx) => {
    const parent = await resolveCreateCommentParentForWrite({
      parentId,
      tx,
      viewer,
      whereTarget: target.whereTarget,
    });
    if (!parent.ok) return parent;

    const comment = await tx.comment.create({
      data: {
        body: content,
        visibility,
        status: "active",
        isAnonymous,
        authorName: null,
        userId,
        parentId: parent.parentId,
        rootId: parent.rootId,
        ...target.whereTarget,
      },
    });

    if (!parent.rootId) {
      await tx.comment.update({
        where: { id: comment.id },
        data: { rootId: comment.id },
      });
    }

    if (attachmentIds.length > 0) {
      await tx.commentAttachment.createMany({
        data: attachmentIds.map((uploadId) => ({
          uploadId,
          commentId: comment.id,
        })),
      });
    }

    await writeCommentAuditLog(tx, {
      action: "comment_create",
      body: content,
      commentId: comment.id,
      metadata: auditMetadata,
      userId,
    });

    return { ok: true as const, comment };
  });
}

export async function updateOwnComment({
  attachmentIds,
  auditMetadata,
  body,
  hasAttachmentUpdate,
  id,
  isAnonymous,
  userId,
  visibility,
}: {
  attachmentIds: string[];
  auditMetadata?: CommentMutationAuditMetadata;
  body?: string;
  hasAttachmentUpdate: boolean;
  id: string;
  isAnonymous?: boolean;
  userId: string;
  visibility?: CommentVisibility;
}) {
  const context = await loadEditableCommentContext({ id, userId });
  if (!context.ok) return context;

  if (hasAttachmentUpdate) {
    const attachmentsValid = await validateCommentAttachmentIds(
      userId,
      attachmentIds,
      { commentId: id },
    );
    if (!attachmentsValid) {
      return { ok: false as const, error: "invalid_attachments" as const };
    }
  }

  let updated = false;
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.comment.updateMany({
        where: { id, status: "active", userId },
        data: {
          body,
          visibility,
          isAnonymous,
        },
      });
      if (result.count !== 1) return;
      updated = true;

      if (hasAttachmentUpdate) {
        await syncCommentAttachments(tx, id, attachmentIds);
      }

      await writeCommentAuditLog(tx, {
        action: "comment_edit",
        body,
        commentId: id,
        metadata: auditMetadata,
        userId,
      });
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    return { ok: false as const, error: "invalid_attachments" as const };
  }
  if (!updated) {
    return loadOwnActiveCommentFailure({ id, userId, viewer: context.viewer });
  }

  const comment = await loadCommentResponse(id, context.viewer);
  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  return { ok: true as const, comment };
}

export async function deleteOwnComment(input: {
  auditMetadata?: CommentMutationAuditMetadata;
  commentId: string;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true, status: true, userId: true, visibility: true },
  });

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  if (comment.userId !== input.userId) {
    return { ok: false as const, error: "forbidden" as const };
  }

  if (!canViewerWriteCommentInteraction(comment, actor.viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.comment.updateMany({
      where: { id: input.commentId, status: "active", userId: input.userId },
      data: {
        status: "deleted",
        deletedAt: new Date(),
      },
    });
    if (result.count !== 1) return false;

    await writeCommentAuditLog(tx, {
      action: "comment_delete",
      commentId: input.commentId,
      metadata: input.auditMetadata,
      userId: input.userId,
    });

    return true;
  });
  if (!deleted) {
    return loadOwnActiveCommentFailure({
      id: input.commentId,
      userId: input.userId,
      viewer: actor.viewer,
    });
  }

  return { ok: true as const };
}

export async function createCommentReaction(input: {
  auditMetadata?: CommentMutationAuditMetadata;
  commentId: string;
  type: string;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true, status: true, visibility: true },
  });

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }
  if (!canViewerWriteCommentInteraction(comment, actor.viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.commentReaction.createMany({
      data: [
        {
          commentId: input.commentId,
          userId: input.userId,
          type: input.type as CommentReactionType,
        },
      ],
      skipDuplicates: true,
    });
    if (result.count === 0) return false;

    await writeCommentAuditLog(tx, {
      action: "comment_react",
      commentId: input.commentId,
      metadata: input.auditMetadata,
      operation: "add",
      reactionType: input.type,
      userId: input.userId,
    });

    return true;
  });

  return { ok: true as const, changed };
}

export async function deleteCommentReaction(input: {
  auditMetadata?: CommentMutationAuditMetadata;
  commentId: string;
  type: CommentReactionType;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true, status: true, visibility: true },
  });

  if (!comment) {
    return { ok: true as const, changed: false };
  }

  if (!canViewerWriteCommentInteraction(comment, actor.viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.commentReaction.deleteMany({
      where: {
        commentId: input.commentId,
        userId: input.userId,
        type: input.type,
      },
    });
    if (result.count === 0) return false;

    await writeCommentAuditLog(tx, {
      action: "comment_react",
      commentId: input.commentId,
      metadata: input.auditMetadata,
      operation: "remove",
      reactionType: input.type,
      userId: input.userId,
    });

    return true;
  });

  return { ok: true as const, changed };
}

async function writeCommentAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    action:
      | "comment_create"
      | "comment_delete"
      | "comment_edit"
      | "comment_react";
    body?: string;
    commentId: string;
    metadata?: CommentMutationAuditMetadata;
    operation?: "add" | "remove";
    reactionType?: string;
    userId: string;
  },
) {
  const { ipAddress, source, userAgent } = input.metadata ?? {};
  const metadata = {
    ...(input.body ? { body: input.body.slice(0, 200) } : {}),
    ...(input.operation ? { operation: input.operation } : {}),
    ...(input.reactionType ? { type: input.reactionType } : {}),
    ...(source ? { source } : {}),
  };
  await writeAuditLog(
    {
      action: input.action,
      userId: input.userId,
      targetId: input.commentId,
      targetType: "comment",
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    },
    tx,
  );
}

export async function validateCommentAttachmentIds(
  userId: string,
  attachmentIds: string[],
  options: { commentId?: string } = {},
) {
  const uploads = await prisma.upload.findMany({
    where: {
      id: { in: attachmentIds },
      userId,
    },
    select: {
      id: true,
      commentAttachments: {
        select: { commentId: true },
      },
    },
  });

  return (
    uploads.length === attachmentIds.length &&
    uploads.every((upload) =>
      upload.commentAttachments.every(
        (attachment) => attachment.commentId === options.commentId,
      ),
    )
  );
}

async function resolveCreateCommentParentForWrite({
  parentId,
  tx,
  viewer,
  whereTarget,
}: {
  parentId: string | null | undefined;
  tx: Prisma.TransactionClient;
  viewer: ViewerInfo;
  whereTarget: Record<string, unknown>;
}) {
  if (!parentId) {
    return { ok: true as const, parentId: null, rootId: null };
  }

  const lockedParent = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Comment" WHERE "id" = ${parentId} FOR UPDATE
  `;
  if (lockedParent.length === 0) {
    return { ok: false as const, error: "parent_not_found" as const };
  }

  const parent = await tx.comment.findUnique({
    where: { id: parentId },
  });
  if (!parent) {
    return { ok: false as const, error: "parent_not_found" as const };
  }
  if (!canViewerWriteCommentInteraction(parent, viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const sameTarget = Object.entries(whereTarget).every(
    ([key, value]) => parent[key as keyof typeof parent] === value,
  );
  if (!sameTarget) {
    return { ok: false as const, error: "target_mismatch" as const };
  }

  return {
    ok: true as const,
    parentId: parent.id,
    rootId: parent.rootId ?? parent.id,
  };
}

async function loadOwnActiveCommentFailure({
  id,
  userId,
  viewer,
}: {
  id: string;
  userId: string;
  viewer: ViewerInfo;
}): Promise<CommentMutationFailure> {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, visibility: true },
  });

  if (!comment) {
    return { ok: false, error: "not_found" };
  }

  if (comment.userId !== userId) {
    return { ok: false, error: "forbidden" };
  }

  if (!canViewerWriteCommentInteraction(comment, viewer)) {
    return { ok: false, error: "locked" };
  }

  return { ok: false, error: "locked" };
}

async function loadEditableCommentContext({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<{ ok: true; viewer: ViewerInfo } | CommentMutationFailure> {
  const viewer = await getViewerContext({ userId });
  if (!viewer.isAuthenticated) {
    return { ok: false, error: "forbidden" };
  }
  if (viewer.isSuspended) {
    return { ok: false, error: "suspended", reason: viewer.suspensionReason };
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });

  if (!comment) {
    return { ok: false, error: "not_found" };
  }

  if (String(comment.status) !== "active") {
    return { ok: false, error: "locked" };
  }

  if (comment.userId !== viewer.userId) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: true, viewer };
}

async function loadActiveCommentActor(
  userId: string,
): Promise<{ ok: true; viewer: ViewerInfo } | CommentMutationFailure> {
  const viewer = await getViewerContext({ userId });
  if (!viewer.isAuthenticated) {
    return { ok: false, error: "forbidden" };
  }
  if (viewer.isSuspended) {
    return { ok: false, error: "suspended", reason: viewer.suspensionReason };
  }
  return { ok: true, viewer };
}

async function syncCommentAttachments(
  tx: Prisma.TransactionClient,
  commentId: string,
  attachmentIds: string[],
) {
  if (attachmentIds.length === 0) {
    await tx.commentAttachment.deleteMany({
      where: { commentId },
    });
    return;
  }

  await tx.commentAttachment.deleteMany({
    where: {
      commentId,
      uploadId: { notIn: attachmentIds },
    },
  });

  const existingAttachments = await tx.commentAttachment.findMany({
    where: {
      commentId,
      uploadId: { in: attachmentIds },
    },
    select: { uploadId: true },
  });
  const existingUploadIds = new Set(
    existingAttachments.map((attachment) => attachment.uploadId),
  );
  const newAttachmentIds = attachmentIds.filter(
    (uploadId) => !existingUploadIds.has(uploadId),
  );

  if (newAttachmentIds.length === 0) return;

  await tx.commentAttachment.createMany({
    data: newAttachmentIds.map((uploadId) => ({
      uploadId,
      commentId,
    })),
  });
}

async function loadCommentResponse(id: string, viewer: ViewerInfo) {
  const updatedComment = await prisma.comment.findUnique({
    where: { id },
    include: commentThreadInclude,
  });

  if (!updatedComment) return null;
  const { roots } = buildCommentNodes([updatedComment], viewer);
  return roots[0];
}
