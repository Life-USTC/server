import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";

export function writeCommentCreateAuditLog({
  body,
  commentId,
  request,
  userId,
}: {
  body: string;
  commentId: string;
  request: Request;
  userId: string;
}) {
  fireAuditLog({
    action: "comment_create",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { body: body.slice(0, 200) },
    ...getAuditRequestMetadata(request),
  });
}
