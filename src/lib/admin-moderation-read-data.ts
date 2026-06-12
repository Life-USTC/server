import type { Prisma } from "@/generated/prisma/client";
import { listModerationComments } from "@/lib/admin-moderation-comment-read-data";
import { listModerationDescriptions } from "@/lib/admin-moderation-description-read-data";
import { listModerationHomeworks } from "@/lib/admin-moderation-homework-read-data";
import { listModerationSuspensions } from "@/lib/admin-moderation-suspension-read-data";
import type { AdminModerationPrisma } from "@/lib/admin-moderation-types";

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
