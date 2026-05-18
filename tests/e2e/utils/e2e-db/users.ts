import {
  buildUserCalendarFeedPath,
  ensureUserCalendarFeedToken,
} from "@/lib/calendar-feed-token";
import { prisma } from "@/lib/db/prisma";

export async function getUserProfileById(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, username: true, image: true },
  });
}

export async function ensureUserCalendarFeedFixture(userId: string) {
  const token = await ensureUserCalendarFeedToken(userId);

  return {
    userId,
    token,
    path: buildUserCalendarFeedPath(userId, token),
  };
}

export async function updateUserProfileById(
  userId: string,
  data: {
    name?: string | null;
    username?: string | null;
    image?: string | null;
  },
) {
  const normalizedData: {
    name?: string;
    username?: string | null;
    image?: string | null;
  } = {};

  if ("name" in data) {
    normalizedData.name = data.name ?? "";
  }
  if ("username" in data) {
    normalizedData.username = data.username ?? null;
  }
  if ("image" in data) {
    normalizedData.image = data.image ?? null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: normalizedData,
  });
}

export async function getUserSubscribedSectionIds(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      subscribedSections: {
        select: { id: true },
        orderBy: { id: "asc" },
      },
    },
  });

  return user.subscribedSections.map((section) => section.id);
}

export async function replaceUserSubscribedSectionIds(
  userId: string,
  sectionIds: number[],
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        set: sectionIds.map((id) => ({ id })),
      },
    },
  });
}

export async function createTempUsersFixture(options: {
  prefix: string;
  count: number;
}) {
  const usernames: string[] = [];

  for (let index = 0; index < options.count; index += 1) {
    const username = `${options.prefix}-${String(index).padStart(2, "0")}`;
    usernames.push(username);
    const user = await prisma.user.upsert({
      where: { username },
      update: {
        email: `${username}@users.local`,
        emailVerified: true,
        name: `E2E ${username}`,
      },
      create: {
        username,
        email: `${username}@users.local`,
        emailVerified: true,
        name: `E2E ${username}`,
      },
    });
    await prisma.verifiedEmail.upsert({
      where: {
        provider_email: {
          provider: "oidc",
          email: `${username}@example.test`,
        },
      },
      update: {
        userId: user.id,
      },
      create: {
        userId: user.id,
        provider: "oidc",
        email: `${username}@example.test`,
      },
    });
  }

  return { usernames };
}

export async function deleteUsersByPrefix(prefix: string) {
  await prisma.user.deleteMany({
    where: {
      username: {
        startsWith: prefix,
      },
    },
  });
}
