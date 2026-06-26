import type { AdminCommentStatusFilter } from "@/features/admin/lib/admin-moderation-filters";
import { prisma } from "@/lib/db/prisma";
import {
  adminDescriptionInclude,
  buildAdminDescriptionWhere,
} from "./admin-description-filters";
import {
  adminHomeworkInclude,
  buildAdminHomeworkWhere,
} from "./admin-homework-filters";
import { buildCommentWhere } from "./admin-moderation-page-filters";

export async function listAdminModerationComments({
  limit,
  status,
}: {
  limit: number;
  status: AdminCommentStatusFilter;
}) {
  const where = buildCommentWhere(status);

  return prisma.comment.findMany({
    where,
    include: {
      user: { select: { name: true } },
      section: {
        select: {
          jwId: true,
          code: true,
          course: { select: { jwId: true, code: true, nameCn: true } },
        },
      },
      course: { select: { jwId: true, code: true, nameCn: true } },
      teacher: { select: { id: true, nameCn: true } },
      homework: {
        select: {
          id: true,
          title: true,
          section: { select: { code: true, jwId: true } },
        },
      },
      sectionTeacher: {
        select: {
          section: {
            select: {
              jwId: true,
              code: true,
              course: { select: { jwId: true, code: true, nameCn: true } },
            },
          },
          teacher: { select: { nameCn: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function listAdminModerationDescriptions({
  hasContent,
  limit,
  search,
  targetType,
}: {
  hasContent: string;
  limit: number;
  search: string;
  targetType: string;
}) {
  return prisma.description.findMany({
    where: buildAdminDescriptionWhere({
      hasContent,
      search,
      targetType,
    }),
    include: adminDescriptionInclude,
    orderBy: [{ lastEditedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
}

export function listAdminModerationHomeworks({
  limit,
  search,
  status,
}: {
  limit: number;
  search: string;
  status: string;
}) {
  return prisma.homework.findMany({
    where: buildAdminHomeworkWhere({ search, status }),
    include: adminHomeworkInclude,
    orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
