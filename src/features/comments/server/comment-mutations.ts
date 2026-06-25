import type {
  CommentReactionType,
  CommentVisibility,
  Prisma,
} from "@/generated/prisma/client";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/db/prisma-errors";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
import { commentThreadInclude } from "./comment-read-model";
import type { ViewerInfo } from "./comment-serialization";
import { buildCommentNodes } from "./comment-serialization";
import { type CommentTargetType, resolveCommentTarget } from "./comment-utils";

type CommentMutationError = "forbidden" | "locked" | "not_found" | "suspended";
type CommentMutationFailure = {
  ok: false;
  error: CommentMutationError;
  reason?: string | null;
};

type CreateCommentParent = {
  parentId: string | null;
  rootId: string | null;
};

type CreateCommentTarget = {
  whereTarget: Record<string, unknown>;
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
  content: string;
  isAnonymous: boolean;
  parentId?: string | null;
  rawTargetId: unknown;
  sectionId?: unknown;
  targetType: CommentTargetType;
  teacherId?: unknown;
  userId: string;
  visibility: CommentVisibility;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const target = await resolveCommentTarget({
    createSectionTeacherTarget: true,
    rawTargetId: input.rawTargetId,
    sectionId: input.sectionId,
    targetType: input.targetType,
    teacherId: input.teacherId,
    verifyExistence: true,
  });
  if (!target) {
    return {
      ok: false as const,
      error: "invalid_target" as CreateCommentError,
    };
  }
  if (!target.verified) {
    return {
      ok: false as const,
      error: "target_not_found" as CreateCommentError,
    };
  }

  const parent = await resolveCreateCommentParent({
    parentId: input.parentId,
    viewer: actor.viewer,
    whereTarget: target.whereTarget,
  });
  if (!parent.ok) {
    return { ok: false as const, error: parent.error };
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

  let comment: Awaited<ReturnType<typeof createCommentRecord>>;
  try {
    comment = await createCommentRecord({
      attachmentIds,
      content: input.content,
      isAnonymous: input.isAnonymous,
      parent,
      target,
      userId: input.userId,
      visibility: input.visibility,
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    return {
      ok: false as const,
      error: "invalid_attachments" as CreateCommentError,
    };
  }

  return { ok: true as const, comment };
}

async function createCommentRecord({
  attachmentIds,
  content,
  isAnonymous,
  parent,
  target,
  userId,
  visibility,
}: {
  attachmentIds: string[];
  content: string;
  isAnonymous: boolean;
  parent: CreateCommentParent;
  target: CreateCommentTarget;
  userId: string;
  visibility: string;
}) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        body: content,
        visibility: visibility as CommentVisibility,
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

    return comment;
  });
}

export async function updateOwnComment({
  attachmentIds,
  body,
  hasAttachmentUpdate,
  id,
  isAnonymous,
  userId,
  visibility,
}: {
  attachmentIds: string[];
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id },
        data: {
          body,
          visibility,
          isAnonymous,
        },
      });

      if (hasAttachmentUpdate) {
        await syncCommentAttachments(tx, id, attachmentIds);
      }
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    return { ok: false as const, error: "invalid_attachments" as const };
  }

  const comment = await loadCommentResponse(id, context.viewer);
  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  return { ok: true as const, comment };
}

export async function deleteOwnComment(input: {
  commentId: string;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true, userId: true },
  });

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  if (comment.userId !== input.userId) {
    return { ok: false as const, error: "forbidden" as const };
  }

  await prisma.comment.update({
    where: { id: input.commentId },
    data: {
      status: "deleted",
      deletedAt: new Date(),
    },
  });

  return { ok: true as const };
}

export async function createCommentReaction(input: {
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

  const result = await prisma.commentReaction.createMany({
    data: [
      {
        commentId: input.commentId,
        userId: input.userId,
        type: input.type as CommentReactionType,
      },
    ],
    skipDuplicates: true,
  });

  return { ok: true as const, changed: result.count > 0 };
}

export async function deleteCommentReaction(input: {
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

  const result = await prisma.commentReaction.deleteMany({
    where: {
      commentId: input.commentId,
      userId: input.userId,
      type: input.type,
    },
  });

  return { ok: true as const, changed: result.count > 0 };
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

async function resolveCreateCommentParent({
  parentId,
  viewer,
  whereTarget,
}: {
  parentId: string | null | undefined;
  viewer: ViewerInfo;
  whereTarget: Record<string, unknown>;
}) {
  if (!parentId) {
    return { ok: true as const, parentId: null, rootId: null };
  }

  const parent = await prisma.comment.findUnique({
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

  if (!viewer.isAdmin && comment.userId !== viewer.userId) {
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
