import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/db/prisma";

export function getUserId(authInfo?: AuthInfo): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Authenticated user context is missing");
  }

  return userId;
}

export async function getViewerInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      isAdmin: true,
    },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return user;
}
