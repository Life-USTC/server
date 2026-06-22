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

export const userApiProfileSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  username: true,
  isAdmin: true,
} as const;

export const viewerInfoSelect = {
  id: true,
  name: true,
  image: true,
  isAdmin: true,
} as const;

export function findUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  });
}

export function findUserApiProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userApiProfileSelect,
  });
}

export function findViewerInfoById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: viewerInfoSelect,
  });
}
