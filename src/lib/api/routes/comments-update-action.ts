import type * as z from "zod";
import {
  badRequest,
  jsonResponse,
  notFound,
  unauthorized,
} from "@/lib/api/helpers";
import type { commentUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import {
  syncCommentAttachments,
  validateCommentAttachmentIds,
} from "./comments-update-attachments";
import { loadEditableCommentContext } from "./comments-update-context";
import {
  loadUpdatedCommentResponse,
  writeCommentEditAuditLog,
} from "./comments-update-response";

type CommentUpdateBody = z.infer<typeof commentUpdateRequestSchema>;

export async function updateCommentAction(
  request: Request,
  id: string,
  parsedBody: CommentUpdateBody,
) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return unauthorized();
  }

  const context = await loadEditableCommentContext({ id, userId });
  if ("error" in context) return context.error;
  const { prisma, viewer } = context;

  const content = parsedBody.body;
  const visibility = parsedBody.visibility;
  const isAnonymous = parsedBody.isAnonymous;
  const hasAttachmentUpdate = Array.isArray(parsedBody.attachmentIds);
  const attachmentIds = hasAttachmentUpdate
    ? (parsedBody.attachmentIds ?? [])
    : [];

  if (hasAttachmentUpdate) {
    const attachmentsValid = await validateCommentAttachmentIds(
      prisma,
      userId,
      attachmentIds,
    );
    if (!attachmentsValid) {
      return badRequest("Invalid attachments");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id },
      data: {
        body: content,
        visibility,
        isAnonymous,
      },
    });

    if (hasAttachmentUpdate) {
      await syncCommentAttachments(tx, id, attachmentIds);
    }
  });

  const updatedCommentResponse = await loadUpdatedCommentResponse(
    prisma,
    id,
    viewer,
  );
  if (!updatedCommentResponse) {
    return notFound();
  }

  writeCommentEditAuditLog({
    body: content,
    request,
    userId,
    commentId: id,
  });

  return jsonResponse({ success: true, comment: updatedCommentResponse });
}
