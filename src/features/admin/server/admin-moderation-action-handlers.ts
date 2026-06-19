import { fail } from "@sveltejs/kit";
import { deleteHomework } from "@/features/homeworks/server/homework-mutations";
import type { CommentStatus } from "@/generated/prisma/client";
import { liftAdminSuspension, moderateComment } from "./admin-api-service";
import {
  type AdminModerationActionEvent,
  getAdminModerationActionContext,
  requiredModerationFormId,
} from "./admin-moderation-action-context";

export async function moderateDescriptionAction({
  locals,
  request,
}: AdminModerationActionEvent) {
  const { admin, copy, form } = await getAdminModerationActionContext({
    locals,
    request,
  });
  const id = requiredModerationFormId(form, copy.missingDescriptionId);
  if (typeof id !== "string") return id;
  const content = String(form.get("content") ?? "");

  const { prisma } = await import("@/lib/db/prisma");
  const existing = await prisma.description.findUnique({
    where: { id },
    select: { id: true, content: true },
  });
  if (!existing)
    return fail(404, { kind: "error", message: copy.descriptionNotFound });

  await prisma.$transaction([
    prisma.description.update({
      where: { id },
      data: {
        content,
        lastEditedAt: new Date(),
        lastEditedById: admin.id,
      },
    }),
    prisma.descriptionEdit.create({
      data: {
        descriptionId: id,
        editorId: admin.id,
        previousContent: existing.content,
        nextContent: content,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: "admin_description_moderate",
        userId: admin.id,
        targetId: id,
        targetType: "description",
        metadata: { previousContent: existing.content, nextContent: content },
      },
    }),
  ]);

  return { kind: "success", message: copy.descriptionUpdateSuccess };
}

export async function moderateCommentAction({
  locals,
  request,
}: AdminModerationActionEvent) {
  const { admin, copy, form } = await getAdminModerationActionContext({
    locals,
    request,
  });
  const id = requiredModerationFormId(form, copy.missingCommentId);
  if (typeof id !== "string") return id;
  const status = String(form.get("status") ?? "active");
  const moderationNote = String(form.get("moderationNote") ?? "").trim();
  if (!["active", "softbanned", "deleted"].includes(status)) {
    return fail(400, { kind: "error", message: copy.invalidStatus });
  }
  const result = await moderateComment(admin.id, id, {
    moderationNote: moderationNote || null,
    status: status as CommentStatus,
  });
  if (!result.ok) {
    return fail(404, { kind: "error", message: copy.missingCommentId });
  }
  return { kind: "success", message: copy.commentUpdateSuccess };
}

export async function deleteHomeworkAction({
  locals,
  request,
}: AdminModerationActionEvent) {
  const { admin, copy, form } = await getAdminModerationActionContext({
    locals,
    request,
  });
  const id = requiredModerationFormId(form, copy.missingHomeworkId);
  if (typeof id !== "string") return id;
  const result = await deleteHomework({
    allowAnyOwner: true,
    homeworkId: id,
    userId: admin.id,
  });
  if (!result.ok) {
    return fail(404, { kind: "error", message: copy.homeworkNotFound });
  }
  return { kind: "success", message: copy.deleteHomeworkSuccess };
}

export async function liftSuspensionAction({
  locals,
  request,
}: AdminModerationActionEvent) {
  const { admin, copy, form } = await getAdminModerationActionContext({
    locals,
    request,
  });
  const id = requiredModerationFormId(form, copy.missingSuspensionId);
  if (typeof id !== "string") return id;
  const result = await liftAdminSuspension(admin.id, id);
  if (!result.ok) {
    return fail(404, { kind: "error", message: copy.missingSuspensionId });
  }
  return { kind: "success", message: copy.liftSuspensionSuccess };
}
