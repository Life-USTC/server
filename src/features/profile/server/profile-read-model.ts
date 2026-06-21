import { prisma } from "@/lib/db/prisma";

export const userProfileSelect = {
  id: true,
  username: true,
  name: true,
  image: true,
  isAdmin: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function findUserProfileForTool(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  });
}
