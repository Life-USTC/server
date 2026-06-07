import { withAdminRoute } from "@/lib/admin-utils";
import {
  jsonResponse,
  notFound,
  parseResourceIdParam,
} from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Soft delete one homework (admin).
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
async function deleteRoute(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminRoute("Failed to delete homework (admin)", async (admin) => {
    const parsed = await parseResourceIdParam(params, "homework");
    if (parsed instanceof Response) {
      return parsed;
    }
    const id = parsed;
    const homework = await prisma.homework.findUnique({
      where: { id },
      select: { id: true, title: true, deletedAt: true, sectionId: true },
    });

    if (!homework) {
      return notFound();
    }

    if (homework.deletedAt) {
      return jsonResponse({ success: true });
    }

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
  });
}
export const DELETE = observedApiRoute(deleteRoute);
