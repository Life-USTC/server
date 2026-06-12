import { withAdminApiRoute } from "@/lib/admin-api";
import { jsonResponse, notFound } from "@/lib/api/helpers";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function deleteAdminHomeworkRoute(
  request: Request,
  params: IdParams,
) {
  return withAdminApiRoute(
    request,
    "Failed to delete homework (admin)",
    async (admin) => {
      const parsed = parseIdParam(params, "homework");
      if (parsed instanceof Response) return parsed;
      const id = parsed.id;

      const { prisma } = await import("@/lib/db/prisma");
      const homework = await prisma.homework.findUnique({
        where: { id },
        select: { id: true, title: true, deletedAt: true, sectionId: true },
      });
      if (!homework) return notFound();
      if (homework.deletedAt) return jsonResponse({ success: true });

      await prisma.$transaction(async (tx) => {
        await tx.homework.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            deletedById: admin.userId,
            updatedById: admin.userId,
          },
        });

        await tx.homeworkAuditLog.create({
          data: {
            action: "deleted",
            sectionId: homework.sectionId,
            homeworkId: homework.id,
            actorId: admin.userId,
            titleSnapshot: homework.title,
          },
        });
      });

      return jsonResponse({ success: true });
    },
  );
}
