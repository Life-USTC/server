import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDebugProviderConfig } from "./debug-auth-config";
import type { DebugProviderId } from "./provider-ids";

type DebugCredentialUserData = {
  username: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string;
  isAdmin: boolean;
  profilePictures: string[];
};

function staleDebugIdentityEmail(userId: string) {
  return `debug-auth-stale-${userId}@debug.local`;
}

export async function ensureDebugCredentialUser(providerId: DebugProviderId) {
  const config = getDebugProviderConfig(providerId);
  const hashedPassword = await hashPassword(config.password);
  const userData: DebugCredentialUserData = {
    username: config.username,
    email: config.email,
    emailVerified: true,
    name: config.name,
    image: config.image,
    isAdmin: config.isAdmin,
    profilePictures: [config.image],
  };

  const upsertDebugUserByIdentity = async () => {
    const matches = await prisma.user.findMany({
      where: {
        OR: [{ username: config.username }, { email: config.email }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        image: true,
        profilePictures: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const existing =
      matches.find((user) => user.username === config.username) ?? matches[0];

    if (existing) {
      for (const conflict of matches.filter(
        (user) => user.id !== existing.id,
      )) {
        await prisma.user.update({
          where: { id: conflict.id },
          data: {
            username: null,
            email: staleDebugIdentityEmail(conflict.id),
          },
        });
      }

      return prisma.user.update({
        where: { id: existing.id },
        data: {
          username: userData.username,
          email: userData.email,
          emailVerified: userData.emailVerified,
          name: userData.name,
          isAdmin: userData.isAdmin,
          image: existing.image || userData.image,
          ...(existing.profilePictures.length > 0
            ? {}
            : { profilePictures: { set: userData.profilePictures } }),
        },
        select: { id: true },
      });
    }

    return prisma.user.create({
      data: userData,
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
