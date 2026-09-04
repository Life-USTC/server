import { sectionCatalogInclude } from "@/features/catalog/server/academic-query-includes";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
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

export function buildWorkspaceHomeworkSelect() {
  return {
    id: true,
    title: true,
    publishedAt: true,
    submissionStartAt: true,
    submissionDueAt: true,
    description: { select: { content: true } },
    section: {
      select: {
        jwId: true,
        course: { select: localizedNameSelect },
      },
    },
  } satisfies Prisma.HomeworkSelect;
}
