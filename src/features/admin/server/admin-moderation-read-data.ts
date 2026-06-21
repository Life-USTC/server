import { listModerationComments } from "@/features/admin/server/admin-moderation-comment-read-data";
import { listModerationDescriptions } from "@/features/admin/server/admin-moderation-description-read-data";
import { listModerationHomeworks } from "@/features/admin/server/admin-moderation-homework-read-data";
import { listModerationSuspensions } from "@/features/admin/server/admin-moderation-suspension-read-data";
import type { AdminModerationPrisma } from "@/features/admin/server/admin-moderation-types";
import type { Prisma } from "@/generated/prisma/client";

export async function getAdminModerationReadData({
  commentWhere,
  descriptionWhere,
  homeworkWhere,
  pageSize,
  descriptionPageSize,
  prisma,
}: {
  commentWhere: Prisma.CommentWhereInput;
  descriptionWhere: Prisma.DescriptionWhereInput;
  homeworkWhere: Prisma.HomeworkWhereInput;
  pageSize: number;
  descriptionPageSize: number;
  prisma: AdminModerationPrisma;
}) {
  return Promise.all([
    listModerationComments({ commentWhere, pageSize, prisma }),
    listModerationDescriptions({
      descriptionPageSize,
      descriptionWhere,
      prisma,
    }),
    listModerationHomeworks({ homeworkWhere, pageSize, prisma }),
    listModerationSuspensions({ pageSize, prisma }),
  ]);
}
