import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function getLatestComments(
  where: Prisma.CommentWhereInput,
  take = 5,
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  const comments = await prisma.comment.findMany({
    where: { ...where, status: { not: "deleted" } },
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      authorName: true,
      createdAt: true,
      user: { select: { name: true, username: true } },
    },
  });

  return comments.map((comment) => ({
    ...comment,
    createdAt: toShanghaiIsoString(comment.createdAt),
  }));
}
