import type * as z from "zod";
import { updateOwnComment } from "@/features/comments/server/comment-mutations";
import {
  badRequest,
  forbidden,
  jsonResponse,
  notFound,
} from "@/lib/api/helpers";
import type { commentUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { writeCommentEditAuditLog } from "./comments-update-audit";

type CommentUpdateBody = z.infer<typeof commentUpdateRequestSchema>;

export async function updateCommentAction(
  request: Request,
  id: string,
  parsedBody: CommentUpdateBody,
  userId: string,
) {
  const content = parsedBody.body;
  const visibility = parsedBody.visibility;
  const isAnonymous = parsedBody.isAnonymous;
  const hasAttachmentUpdate = Array.isArray(parsedBody.attachmentIds);
  const attachmentIds = hasAttachmentUpdate
    ? (parsedBody.attachmentIds ?? [])
    : [];

  const result = await updateOwnComment({
    attachmentIds,
    body: content,
    hasAttachmentUpdate,
    id,
    isAnonymous,
    userId,
    visibility,
  });

  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    if (result.error === "invalid_attachments") {
      return badRequest("Invalid attachments");
    }
    if (result.error === "locked") return forbidden("Comment locked");
    return forbidden();
  }

  writeCommentEditAuditLog({
    body: content,
    request,
    userId,
    commentId: id,
  });

  return jsonResponse({ success: true, comment: result.comment });
}
