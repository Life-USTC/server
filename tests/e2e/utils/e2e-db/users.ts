import { createLocalAccountIssuer } from "@better-auth/core/db";
import { hashPassword } from "better-auth/crypto";
import { deleteAuditLogsForUsersAndTargetsUntilStable } from "../../../shared/audit-cleanup";
import { DEV_SEED } from "../dev-seed";
import { generateToken } from "./core";
import { withE2ePrisma } from "./prisma";

const DEBUG_USER_ID = "cmqw1sr9g0001bqt44c3s0kqa";
const DEBUG_USER_EMAIL = "dev-user@debug.local";
const DEBUG_USER_PASSWORD = "dev-debug-password";

/**
 * Restore the named debug fixture after the destructive account-deletion E2E.
 * This is an owner-side test operation; the Worker auth role never provisions
 * users or credentials.
 */
export async function restoreDebugUserFixture() {
  const image = `https://api.dicebear.com/9.x/shapes/svg?seed=${DEV_SEED.debugAvatarSeed}`;
  const password = await hashPassword(DEBUG_USER_PASSWORD);
  const credentialIssuer = createLocalAccountIssuer("credential");

  await withE2ePrisma(async (prisma) => {
    await prisma.user.upsert({
      where: { id: DEBUG_USER_ID },
      update: {
        email: DEBUG_USER_EMAIL,
        emailVerified: true,
        name: DEV_SEED.debugName,
        image,
        profilePictures: [image],
        username: DEV_SEED.debugUsername,
        isAdmin: false,
      },
      create: {
        id: DEBUG_USER_ID,
        email: DEBUG_USER_EMAIL,
        emailVerified: true,
        name: DEV_SEED.debugName,
        image,
        profilePictures: [image],
        username: DEV_SEED.debugUsername,
        isAdmin: false,
      },
    });

    await prisma.account.upsert({
      where: {
        issuer_providerAccountId: {
          issuer: credentialIssuer,
          providerAccountId: DEBUG_USER_ID,
        },
      },
      update: {
        userId: DEBUG_USER_ID,
        type: "credential",
        provider: "credential",
        issuer: credentialIssuer,
        password,
      },
      create: {
        userId: DEBUG_USER_ID,
        type: "credential",
        provider: "credential",
        issuer: credentialIssuer,
        providerAccountId: DEBUG_USER_ID,
        password,
      },
    });
  });
}

function buildUserCalendarFeedPath(userId: string, token: string): string {
  return `/api/calendar-feeds/${userId}:${token}.ics`;
}

export async function getUserProfileById(userId: string) {
  return await withE2ePrisma((prisma) =>
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        username: true,
        image: true,
        profilePictures: true,
      },
    }),
  );
}

export async function ensureUserCalendarFeedFixture(userId: string) {
  const token = await withE2ePrisma(async (prisma) => {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { calendarFeedToken: true },
    });
    if (existing?.calendarFeedToken) return existing.calendarFeedToken;

    const createdToken = generateToken(24);
    await prisma.user.update({
      where: { id: userId },
      data: { calendarFeedToken: createdToken },
    });
    return createdToken;
  });

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
    profilePictures?: string[];
  },
) {
  const normalizedData: {
    name?: string;
    username?: string | null;
    image?: string | null;
    profilePictures?: string[];
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
  if ("profilePictures" in data) {
    normalizedData.profilePictures = data.profilePictures ?? [];
  }

  await withE2ePrisma((prisma) =>
    prisma.user.update({
      where: { id: userId },
      data: normalizedData,
    }),
  );
}

export async function getUserSubscribedSectionIds(userId: string) {
  const rows = await withE2ePrisma((prisma) =>
    prisma.userSectionSubscription.findMany({
      where: { userId },
      select: { sectionId: true },
      orderBy: { sectionId: "asc" },
    }),
  );

  return rows.map((row) => row.sectionId);
}

export async function replaceUserSubscribedSectionIds(
  userId: string,
  sectionIds: number[],
) {
  await withE2ePrisma(async (prisma) => {
    await prisma.userSectionSubscription.deleteMany({ where: { userId } });
    if (sectionIds.length === 0) return;
    await prisma.userSectionSubscription.createMany({
      data: sectionIds.map((sectionId) => ({ userId, sectionId })),
      skipDuplicates: true,
    });
  });
}

export async function deletePasskeysForUserFixture(userId: string) {
  await withE2ePrisma((prisma) =>
    prisma.passkey.deleteMany({
      where: { userId },
    }),
  );
}

export async function createTempUsersFixture(options: {
  prefix: string;
  count: number;
}) {
  const usernames: string[] = [];
  const userIds: string[] = [];

  await withE2ePrisma(async (prisma) => {
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
      userIds.push(user.id);
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
  });

  return { userIds, usernames };
}

export async function deleteUsersByPrefix(prefix: string) {
  await withE2ePrisma(async (prisma) => {
    const users = await prisma.user.findMany({
      where: {
        username: {
          startsWith: prefix,
        },
      },
      select: {
        id: true,
        comments: { select: { id: true } },
        uploads: { select: { id: true } },
      },
    });
    if (users.length === 0) return;

    const userIds = users.map((user) => user.id);
    const targets = [
      { targetType: "user", targetIds: userIds },
      {
        targetType: "comment",
        targetIds: users.flatMap((user) =>
          user.comments.map((comment) => comment.id),
        ),
      },
      {
        targetType: "upload",
        targetIds: users.flatMap((user) =>
          user.uploads.map((upload) => upload.id),
        ),
      },
    ];

    await deleteAuditLogsForUsersAndTargetsUntilStable(prisma, {
      userIds,
      targets,
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await deleteAuditLogsForUsersAndTargetsUntilStable(prisma, {
      userIds,
      targets,
    });
  });
}
