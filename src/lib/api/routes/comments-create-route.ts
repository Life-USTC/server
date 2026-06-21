import {
  resolveCreateCommentParent,
  validateCommentAttachmentIds,
} from "@/features/comments/server/comment-mutations";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { commentCreateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/api-auth";
import {
  createCommentRecord,
  resolveCreateCommentTarget,
  writeCommentCreateAuditLog,
} from "./comments-create-helpers";

export async function postCommentRoute(request: Request) {
  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    commentCreateRequestSchema,
    "Invalid comment request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const targetType = parsedBody.targetType;
  const content = parsedBody.body;
  const visibility = parsedBody.visibility ?? "public";
  const isAnonymous = parsedBody.isAnonymous === true;

  try {
    const target = await resolveCreateCommentTarget({
      rawTargetId: parsedBody.targetId,
      sectionId: parsedBody.sectionId,
      targetType,
      teacherId: parsedBody.teacherId,
    });
    if (!target.ok) return target.response;

    const parent = await resolveCreateCommentParent(
      parsedBody.parentId,
      target.target.whereTarget,
    );
    if (!parent.ok) {
      if (parent.error === "parent_not_found") {
        return notFound("Parent not found");
      }
      return badRequest("Parent target mismatch");
    }

    const attachmentIds = parsedBody.attachmentIds ?? [];

    if (attachmentIds.length > 0) {
      if (!(await validateCommentAttachmentIds(userId, attachmentIds))) {
        return badRequest("Invalid attachments");
      }
    }

    const comment = await createCommentRecord({
      attachmentIds,
      content,
      isAnonymous,
      parent,
      target,
      userId,
      visibility,
    });

    writeCommentCreateAuditLog({
      body: content,
      commentId: comment.id,
      request,
      userId,
    });

    return jsonResponse({ id: comment.id });
  } catch (error) {
    return handleRouteError("Failed to create comment", error);
  }
}
