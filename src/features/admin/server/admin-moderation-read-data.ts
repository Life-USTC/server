import { listModerationComments } from "@/features/admin/server/admin-moderation-comment-read-data";
import { listModerationDescriptions } from "@/features/admin/server/admin-moderation-description-read-data";
import { listModerationHomeworks } from "@/features/admin/server/admin-moderation-homework-read-data";
import { listModerationSuspensions } from "@/features/admin/server/admin-moderation-suspension-read-data";
import type { AdminModerationPrisma } from "@/features/admin/server/admin-moderation-types";
import type { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";

export async function getAdminModerationReadData({
  adminUserId,
  commentWhere,
  descriptionWhere,
  homeworkWhere,
  pageSize,
  descriptionPageSize,
  prisma,
}: {
  adminUserId: string;
  commentWhere: Prisma.CommentWhereInput;
  descriptionWhere: Prisma.DescriptionWhereInput;
  homeworkWhere: Prisma.HomeworkWhereInput;
  pageSize: number;
  descriptionPageSize: number;
  prisma: AdminModerationPrisma;
}) {
  const comments = await withUserDbContext(adminUserId, (tx) =>
    listModerationComments({ commentWhere, pageSize, prisma: tx }),
  );

  return Promise.all([
    Promise.resolve(comments),
    listModerationDescriptions({
      descriptionPageSize,
      descriptionWhere,
      prisma,
    }),
    listModerationHomeworks({ homeworkWhere, pageSize, prisma }),
    listModerationSuspensions({ pageSize, prisma }),
  ]);
}
