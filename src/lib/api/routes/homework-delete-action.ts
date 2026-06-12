import { forbidden, jsonResponse, notFound } from "@/lib/api/helpers";

export async function deleteHomeworkAction(id: string, userId: string) {
  const [{ getViewerContext }, { prisma }] = await Promise.all([
    import("@/lib/auth/viewer-context"),
    import("@/lib/db/prisma"),
  ]);
  const viewer = await getViewerContext({
    includeAdmin: true,
    userId,
  });
  const homework = await prisma.homework.findUnique({
    where: { id },
    select: { id: true, title: true, createdById: true, sectionId: true },
  });

  if (!homework) {
    return notFound();
  }

  if (!viewer.isAdmin && homework.createdById !== userId) {
    return forbidden();
  }

  await prisma.$transaction(async (tx) => {
    await tx.homework.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: userId,
        updatedById: userId,
      },
    });

    await tx.homeworkAuditLog.create({
      data: {
        action: "deleted",
        sectionId: homework.sectionId,
        homeworkId: homework.id,
        actorId: userId,
        titleSnapshot: homework.title,
      },
    });
  });

  return jsonResponse({ success: true });
}
