import type {
  CommentReactionType,
  CommentVisibility,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { commentThreadInclude } from "./comment-read-model";
import type { ViewerInfo } from "./comment-serialization";
import { buildCommentNodes } from "./comment-serialization";

type CommentMutationError = "forbidden" | "locked" | "not_found";

type CreateCommentParent = {
  parentId: string | null;
  rootId: string | null;
};

type CreateCommentTarget = {
  target: {
    whereTarget: Record<string, unknown>;
  };
};

export async function createCommentRecord({
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
  const comment = await prisma.comment.create({
    data: {
      body: content,
      visibility: visibility as CommentVisibility,
      status: "active",
      isAnonymous,
      authorName: null,
      userId,
      parentId: parent.parentId,
      rootId: parent.rootId,
      ...target.target.whereTarget,
    },
  });

  if (!parent.rootId) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { rootId: comment.id },
    });
  }

  if (attachmentIds.length > 0) {
    await prisma.commentAttachment.createMany({
      data: attachmentIds.map((uploadId) => ({
        uploadId,
        commentId: comment.id,
      })),
      skipDuplicates: true,
    });
  }

  return comment;
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
    );
    if (!attachmentsValid) {
      return { ok: false as const, error: "invalid_attachments" as const };
    }
  }

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
  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true },
  });

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  await prisma.commentReaction.upsert({
    where: {
      commentId_userId_type: {
        commentId: input.commentId,
        userId: input.userId,
        type: input.type as CommentReactionType,
      },
    },
    update: {},
    create: {
      commentId: input.commentId,
      userId: input.userId,
      type: input.type as CommentReactionType,
    },
  });

  return { ok: true as const };
}

export async function deleteCommentReaction(input: {
  commentId: string;
  type: CommentReactionType;
  userId: string;
}) {
  await prisma.commentReaction.deleteMany({
    where: {
      commentId: input.commentId,
      userId: input.userId,
      type: input.type,
    },
  });
}

export async function validateCommentAttachmentIds(
  userId: string,
  attachmentIds: string[],
) {
  const uploads = await prisma.upload.findMany({
    where: {
      id: { in: attachmentIds },
      userId,
    },
    select: { id: true },
  });

  return uploads.length === attachmentIds.length;
}

export async function resolveCreateCommentParent(
  parentId: string | null | undefined,
  whereTarget: Record<string, unknown>,
) {
  if (!parentId) {
    return { ok: true as const, parentId: null, rootId: null };
  }

  const parent = await prisma.comment.findUnique({
    where: { id: parentId },
  });
  if (!parent) {
    return { ok: false as const, error: "parent_not_found" as const };
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
}): Promise<
  { ok: true; viewer: ViewerInfo } | { ok: false; error: CommentMutationError }
> {
  const { getViewerContext } = await import("@/lib/auth/viewer-context");
  const viewer = await getViewerContext({ userId });
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });

  if (!comment) {
    return { ok: false, error: "not_found" };
  }

  if (String(comment.status) === "deleted") {
    return { ok: false, error: "locked" };
  }

  if (!viewer.isAdmin && comment.userId !== viewer.userId) {
    return { ok: false, error: "forbidden" };
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

  await tx.commentAttachment.createMany({
    data: attachmentIds.map((uploadId) => ({
      uploadId,
      commentId,
    })),
    skipDuplicates: true,
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
