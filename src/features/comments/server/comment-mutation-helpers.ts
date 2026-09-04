import type { Prisma } from "@/generated/prisma/client";
import {
  type AuditLogParams,
  writeAuditLog,
} from "@/lib/audit/write-audit-log";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { withCommentDbContext } from "./comment-db-context";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
import {
  commentThreadInclude,
  withCommentReadMetadata,
} from "./comment-read-model";
import type { ViewerInfo } from "./comment-serialization";
import { buildCommentNodes } from "./comment-serialization";

export type CommentMutationError =
  | "forbidden"
  | "locked"
  | "not_found"
  | "suspended";

export type CommentMutationFailure = {
  ok: false;
  error: CommentMutationError;
  reason?: string | null;
};

export type CreateCommentTarget = {
  whereTarget: Record<string, unknown>;
};

export type CommentMutationAuditMetadata = Pick<
  AuditLogParams,
  | "channel"
  | "ipAddress"
  | "oauthClientId"
  | "oauthGrantId"
  | "requestId"
  | "sessionId"
  | "subjectUserId"
  | "userAgent"
> & {
  source?: string;
};

export type CreateCommentError =
  | "forbidden"
  | "invalid_attachments"
  | "invalid_target"
  | "locked"
  | "parent_not_found"
  | "suspended"
  | "target_mismatch"
  | "target_not_found";

export async function writeCommentAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    action:
      | "comment_create"
      | "comment_delete"
      | "comment_edit"
      | "comment_react";
    commentId: string;
    metadata?: CommentMutationAuditMetadata;
    operation?: "add" | "remove";
    reactionType?: string;
    userId: string;
  },
) {
  const { source, ...audit } = input.metadata ?? {};
  const metadata = {
    ...(input.operation ? { operation: input.operation } : {}),
    ...(input.reactionType ? { type: input.reactionType } : {}),
    ...(source ? { source } : {}),
  };
  await writeAuditLog(
    {
      action: input.action,
      ...audit,
      userId: input.userId,
      subjectUserId: audit.subjectUserId ?? input.userId,
      targetId: input.commentId,
      targetType: "comment",
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    },
    tx,
  );
}

export async function loadOwnActiveCommentFailure({
  id,
  userId,
  viewer,
}: {
  id: string;
  userId: string;
  viewer: ViewerInfo;
}): Promise<CommentMutationFailure> {
  const comment = await withCommentDbContext(userId, (client) =>
    client.comment.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true, visibility: true },
    }),
  );

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

export async function loadEditableCommentContext({
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

  const comment = await withCommentDbContext(userId, (client) =>
    client.comment.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    }),
  );

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

export async function loadActiveCommentActor(
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

export async function loadCommentResponse(id: string, viewer: ViewerInfo) {
  const updatedComment = await withCommentDbContext(viewer.userId, (client) =>
    client.comment.findUnique({
      where: { id },
      include: commentThreadInclude,
    }),
  );

  if (!updatedComment) return null;
  const commentsWithMetadata = await withCommentReadMetadata(
    [updatedComment],
    viewer.userId,
  );
  const { roots } = buildCommentNodes(commentsWithMetadata, viewer);
  return roots[0];
}
