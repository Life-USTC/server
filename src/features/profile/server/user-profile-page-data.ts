import { buildUserProfileContributions } from "@/features/profile/server/user-profile-contributions";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

const publicUserIdentitySelect = {
  id: true,
  username: true,
  name: true,
  image: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

async function getUserProfileData(where: Prisma.UserWhereUniqueInput) {
  const prisma = getPrisma("zh-cn");
  const user = await prisma.user.findUnique({
    where,
    select: {
      ...publicUserIdentitySelect,
      _count: {
        select: {
          comments: true,
          uploads: true,
          homeworksCreated: true,
          subscribedSections: true,
        },
      },
    },
  });

  if (!user) return null;

  const { totalContributions, weeks } = await buildUserProfileContributions(
    prisma,
    user.id,
  );

  return toLoadData({
    user,
    sectionCount: user._count.subscribedSections,
    weeks,
    totalContributions,
  });
}

export async function getUserProfileByUsername(username: string) {
  return getUserProfileData({ username });
}

export async function getUserProfileById(id: string) {
  return getUserProfileData({ id });
}

export async function getPublicUserIdentityByIdentifier(identifier: string) {
  const normalized = identifier.trim();
  if (!normalized) return null;

  const prisma = getPrisma("zh-cn");
  const user =
    (await prisma.user.findUnique({
      where: { username: normalized.toLowerCase() },
      select: publicUserIdentitySelect,
    })) ??
    (await prisma.user.findUnique({
      where: { id: normalized },
      select: publicUserIdentitySelect,
    }));

  return user ? toLoadData(user) : null;
}
