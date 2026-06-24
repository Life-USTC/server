import { prisma } from "@/lib/db/prisma";

export const authenticatedUserProfileSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  image: true,
  isAdmin: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const viewerInfoSelect = {
  id: true,
  name: true,
  image: true,
  isAdmin: true,
} as const;

export function findAuthenticatedUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: authenticatedUserProfileSelect,
  });
}

export function findViewerInfoById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: viewerInfoSelect,
  });
}
