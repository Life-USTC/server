import { fireAuditLog } from "@/lib/audit/write-audit-log";

type CommentAuditRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type CommentAuditMetadata = Record<string, unknown>;

export async function writeCommentCreateAuditLog({
  auditMetadata,
  body,
  commentId,
  requestMetadata,
  userId,
}: {
  auditMetadata?: CommentAuditMetadata;
  body: string;
  commentId: string;
  requestMetadata?: CommentAuditRequestMetadata;
  userId: string;
}) {
  await fireAuditLog({
    action: "comment_create",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { body: body.slice(0, 200), ...auditMetadata },
    ...requestMetadata,
  });
}

export async function writeCommentEditAuditLog({
  auditMetadata,
  body,
  commentId,
  requestMetadata,
  userId,
}: {
  auditMetadata?: CommentAuditMetadata;
  body?: string;
  commentId: string;
  requestMetadata?: CommentAuditRequestMetadata;
  userId: string;
}) {
  await fireAuditLog({
    action: "comment_edit",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: {
      ...(body ? { body: body.slice(0, 200) } : {}),
      ...auditMetadata,
    },
    ...requestMetadata,
  });
}

export async function writeCommentDeleteAuditLog({
  auditMetadata,
  commentId,
  requestMetadata,
  userId,
}: {
  auditMetadata?: CommentAuditMetadata;
  commentId: string;
  requestMetadata?: CommentAuditRequestMetadata;
  userId: string;
}) {
  await fireAuditLog({
    action: "comment_delete",
    userId,
    targetId: commentId,
    targetType: "comment",
    ...(auditMetadata ? { metadata: auditMetadata } : {}),
    ...requestMetadata,
  });
}

export async function writeCommentReactionAuditLog({
  auditMetadata,
  commentId,
  operation,
  requestMetadata,
  type,
  userId,
}: {
  auditMetadata?: CommentAuditMetadata;
  commentId: string;
  operation: "add" | "remove";
  requestMetadata?: CommentAuditRequestMetadata;
  type: string;
  userId: string;
}) {
  await fireAuditLog({
    action: "comment_react",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { operation, type, ...auditMetadata },
    ...requestMetadata,
  });
}
