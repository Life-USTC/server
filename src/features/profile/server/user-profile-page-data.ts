import {
  buildUserProfileContributions,
  loadPublicProfileSectionSubscriptionCount,
  loadPublicProfileUploadCount,
} from "@/features/profile/server/user-profile-contributions";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

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
          homeworksCreated: true,
        },
      },
    },
  });

  if (!user) return null;

  const profileSince = shanghaiDayjs()
    .subtract(364, "day")
    .startOf("day")
    .toDate();
  const [{ totalContributions, weeks }, totalUploads, sectionCount] =
    await Promise.all([
      buildUserProfileContributions(prisma, user.id),
      loadPublicProfileUploadCount(prisma, user.id, profileSince),
      loadPublicProfileSectionSubscriptionCount(prisma, user.id),
    ]);

  return toLoadData({
    user: {
      ...user,
      _count: {
        comments: user._count.comments,
        homeworksCreated: user._count.homeworksCreated,
        subscribedSections: sectionCount,
        uploads: totalUploads,
      },
    },
    sectionCount,
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
