import type { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  auditCommentIdentityRead,
  requireCommentIdentityModerator,
} from "./admin-comment-identity-read";

export async function listModerationComments({
  commentWhere,
  pageSize,
  adminUserId,
}: {
  commentWhere: Prisma.CommentWhereInput;
  pageSize: number;
  adminUserId: string;
}) {
  return withUserDbContext(adminUserId, async (tx) => {
    await requireCommentIdentityModerator(tx, adminUserId);
    const comments = await tx.comment.findMany({
      where: commentWhere,
      select: {
        id: true,
        body: true,
        authorName: true,
        status: true,
        isAnonymous: true,
        moderationNote: true,
        createdAt: true,
        userId: true,
        user: { select: { id: true, name: true, username: true } },
        course: { select: { jwId: true, code: true, nameCn: true } },
        section: {
          select: {
            jwId: true,
            code: true,
            course: { select: { nameCn: true } },
          },
        },
        teacher: { select: { id: true, nameCn: true } },
        homework: {
          select: {
            id: true,
            section: { select: { jwId: true } },
            title: true,
          },
        },
        sectionTeacher: {
          select: {
            section: {
              select: {
                jwId: true,
                code: true,
                course: { select: { nameCn: true } },
              },
            },
            teacher: { select: { nameCn: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
    });
    await auditCommentIdentityRead({
      adminUserId,
      channel: "web",
      client: tx,
      comments,
    });
    return comments;
  });
}
