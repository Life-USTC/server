import { fireAuditLog } from "@/lib/audit/write-audit-log";

type CommentAuditRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type CommentAuditMetadata = Record<string, unknown>;

export function writeCommentCreateAuditLog({
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
  fireAuditLog({
    action: "comment_create",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { body: body.slice(0, 200), ...auditMetadata },
    ...requestMetadata,
  });
}

export function writeCommentEditAuditLog({
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
  fireAuditLog({
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

export function writeCommentDeleteAuditLog({
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
  fireAuditLog({
    action: "comment_delete",
    userId,
    targetId: commentId,
    targetType: "comment",
    ...(auditMetadata ? { metadata: auditMetadata } : {}),
    ...requestMetadata,
  });
}

export function writeCommentReactionAuditLog({
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
  fireAuditLog({
    action: "comment_react",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { operation, type, ...auditMetadata },
    ...requestMetadata,
  });
}
