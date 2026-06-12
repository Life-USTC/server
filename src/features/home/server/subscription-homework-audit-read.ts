import { prisma } from "@/lib/db/prisma";
import { withSubscribedSections } from "./subscription-read-model-shared";

export async function listSubscribedHomeworkAuditLogs(
  userId: string,
  limit = 50,
  sectionIds?: readonly number[],
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      return prisma.homeworkAuditLog.findMany({
        where: { sectionId: { in: ids } },
        include: {
          actor: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    },
    sectionIds,
  );
}
