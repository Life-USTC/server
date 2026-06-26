import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDebugProviderConfig } from "./debug-auth-config";
import type { DebugProviderId } from "./provider-ids";

function buildSupersededDebugEmail(
  providerId: DebugProviderId,
  userId: string,
) {
  return `debug-auth-superseded-${providerId}-${userId}@debug.local`;
}

export async function ensureDebugCredentialUser(providerId: DebugProviderId) {
  const config = getDebugProviderConfig(providerId);
  const hashedPassword = await hashPassword(config.password);
  const userData = {
    username: config.username,
    email: config.email,
    emailVerified: true,
    name: config.name,
    image: config.image,
    isAdmin: config.isAdmin,
    profilePictures: [config.image],
  };
  const userUpdateData = {
    username: userData.username,
    email: userData.email,
    emailVerified: userData.emailVerified,
    name: userData.name,
    isAdmin: userData.isAdmin,
    image: userData.image,
    profilePictures: { set: userData.profilePictures },
  };

  const upsertDebugUserByIdentity = async () => {
    const [usernameMatch, emailMatch] = await Promise.all([
      prisma.user.findUnique({
        where: { username: config.username },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { email: config.email },
        select: { id: true },
      }),
    ]);
    const existing = usernameMatch ?? emailMatch;

    if (!existing) {
      return prisma.user.create({
        data: userData,
        select: { id: true },
      });
    }

    if (usernameMatch && emailMatch && usernameMatch.id !== emailMatch.id) {
      await prisma.user.update({
        where: { id: emailMatch.id },
        data: { email: buildSupersededDebugEmail(providerId, emailMatch.id) },
        select: { id: true },
      });
    }

    return prisma.user.update({
      where: { id: existing.id },
      data: userUpdateData,
      select: { id: true },
    });
  };

  let user: { id: string };
  try {
    user = await upsertDebugUserByIdentity();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      user = await upsertDebugUserByIdentity();
    } else {
      throw error;
    }
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "credential",
        providerAccountId: user.id,
      },
    },
    update: {
      userId: user.id,
      type: "credential",
      provider: "credential",
      password: hashedPassword,
    },
    create: {
      userId: user.id,
      type: "credential",
      provider: "credential",
      providerAccountId: user.id,
      password: hashedPassword,
    },
  });
}
