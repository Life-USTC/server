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
  pageSize,
  skip,
  status,
}: {
  pageSize: number;
  skip: number;
  status: AdminCommentStatusFilter;
}) {
  const where = buildCommentWhere(status);

  const [data, total] = await Promise.all([
    prisma.comment.findMany({
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.comment.count({ where }),
  ]);

  return { data, total };
}

export async function listAdminModerationDescriptions({
  hasContent,
  pageSize,
  search,
  skip,
  targetType,
}: {
  hasContent: string;
  pageSize: number;
  search: string;
  skip: number;
  targetType: string;
}) {
  const where = buildAdminDescriptionWhere({ hasContent, search, targetType });
  const [data, total] = await Promise.all([
    prisma.description.findMany({
      where,
      include: adminDescriptionInclude,
      orderBy: [
        { lastEditedAt: "desc" },
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: pageSize,
    }),
    prisma.description.count({ where }),
  ]);
  return { data, total };
}

export async function listAdminModerationHomeworks({
  pageSize,
  search,
  skip,
  status,
}: {
  pageSize: number;
  search: string;
  skip: number;
  status: string;
}) {
  const where = buildAdminHomeworkWhere({ search, status });
  const [data, total] = await Promise.all([
    prisma.homework.findMany({
      where,
      include: adminHomeworkInclude,
      orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.homework.count({ where }),
  ]);
  return { data, total };
}
