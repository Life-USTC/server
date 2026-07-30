import { sectionCatalogInclude } from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";

export function buildSubscribedHomeworkInclude(includeEditors: boolean) {
  return {
    section: { include: sectionCatalogInclude },
    description: true,
    ...(includeEditors
      ? {
          createdBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          updatedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          deletedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;
}

export function buildDashboardHomeworkSelect() {
  return {
    id: true,
    title: true,
    publishedAt: true,
    submissionStartAt: true,
    submissionDueAt: true,
    description: { select: { content: true } },
    section: { select: { jwId: true, course: true } },
  } satisfies Prisma.HomeworkSelect;
}
