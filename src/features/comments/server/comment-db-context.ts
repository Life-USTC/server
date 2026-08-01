import type { Prisma } from "@/generated/prisma/client";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

export type CommentDbClient = Pick<Prisma.TransactionClient, "comment">;

export async function withCommentDbContext<T>(
  viewerUserId: string | null,
  action: (client: CommentDbClient) => Promise<T>,
): Promise<T> {
  if (viewerUserId) {
    return withUserDbContext(viewerUserId, action);
  }

  return action(prisma);
}
