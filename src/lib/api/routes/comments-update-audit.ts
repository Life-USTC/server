import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";

export function writeCommentEditAuditLog({
  body,
  commentId,
  request,
  userId,
}: {
  body?: string;
  commentId: string;
  request: Request;
  userId: string;
}) {
  fireAuditLog({
    action: "comment_edit",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { body: body?.slice(0, 200) },
    ...getAuditRequestMetadata(request),
  });
}
