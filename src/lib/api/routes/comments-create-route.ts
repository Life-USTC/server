import {
  badRequest,
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { commentCreateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/api-auth";
import {
  createCommentRecord,
  resolveCreateCommentParent,
  resolveCreateCommentTarget,
  writeCommentCreateAuditLog,
} from "./comments-create-helpers";
import { validateCommentAttachmentIds } from "./comments-update-attachments";

export async function postCommentRoute(request: Request) {
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

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const target = await resolveCreateCommentTarget({
      rawTargetId: parsedBody.targetId,
      sectionId: parsedBody.sectionId,
      targetType,
      teacherId: parsedBody.teacherId,
    });
    if (!target.ok) return target.response;

    const parent = await resolveCreateCommentParent(
      prisma,
      parsedBody.parentId,
      target.target.whereTarget,
    );
    if (!parent.ok) return parent.response;

    const attachmentIds = parsedBody.attachmentIds ?? [];

    if (attachmentIds.length > 0) {
      if (
        !(await validateCommentAttachmentIds(prisma, userId, attachmentIds))
      ) {
        return badRequest("Invalid attachments");
      }
    }

    const comment = await createCommentRecord(prisma, {
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
