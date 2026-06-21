import { buildUserProfileContributions } from "@/features/profile/server/user-profile-contributions";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

async function getUserProfileData(where: Prisma.UserWhereUniqueInput) {
  const prisma = getPrisma("zh-cn");
  const user = await prisma.user.findUnique({
    where,
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      createdAt: true,
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
