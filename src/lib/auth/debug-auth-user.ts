import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDebugProviderConfig } from "./debug-auth-config";
import type { DebugProviderId } from "./provider-ids";

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

  const upsertDebugUserByIdentity = async () => {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: config.username }, { email: config.email }],
      },
      select: { id: true, image: true, profilePictures: true },
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          email: userData.email,
          emailVerified: userData.emailVerified,
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
