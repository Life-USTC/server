import type { Prisma } from "@/generated/prisma/client";
import { getPagePrisma, toLoadData } from "@/lib/page-data-utils";
import { buildUserProfileContributions } from "@/lib/user-profile-contributions";

async function getUserProfileData(where: Prisma.UserWhereUniqueInput) {
  const prisma = await getPagePrisma();
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
