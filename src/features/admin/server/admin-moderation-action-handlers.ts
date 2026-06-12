import { fail } from "@sveltejs/kit";
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
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.comment.update({
    where: { id },
    data: {
      status: status as "active" | "softbanned" | "deleted",
      moderationNote: moderationNote || null,
      moderatedAt: new Date(),
      moderatedById: admin.id,
      deletedAt: status === "deleted" ? new Date() : null,
    },
  });
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
  const { prisma } = await import("@/lib/db/prisma");
  const homework = await prisma.homework.findUnique({
    where: { id },
    select: { id: true, title: true, deletedAt: true, sectionId: true },
  });
  if (!homework)
    return fail(404, { kind: "error", message: copy.homeworkNotFound });
  if (!homework.deletedAt) {
    await prisma.$transaction([
      prisma.homework.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: admin.id,
          updatedById: admin.id,
        },
      }),
      prisma.homeworkAuditLog.create({
        data: {
          action: "deleted",
          sectionId: homework.sectionId,
          homeworkId: homework.id,
          actorId: admin.id,
          titleSnapshot: homework.title,
        },
      }),
    ]);
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
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.userSuspension.update({
    where: { id },
    data: { liftedAt: new Date(), liftedById: admin.id },
  });
  return { kind: "success", message: copy.liftSuspensionSuccess };
}
