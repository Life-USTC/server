import type { Account } from "@better-auth/core/db";
import {
  isPlaceholderUserEmail,
  isPublishableUserEmail,
} from "@/lib/auth/oauth-user-email";
import { upsertVerifiedEmail } from "@/lib/auth/oauth-user-email-resolve";
import { consumeStagedSocialVerifiedEmail } from "@/lib/auth/social-verified-email-staging";
import { authPrisma } from "@/lib/db/auth-prisma";

const SOCIAL_PROFILE_PROVIDERS = new Set(["github", "google", "oidc"]);

type AccountHookPayload = Pick<
  Account,
  "providerId" | "providerAccountId" | "userId"
>;

async function applySocialVerifiedEmailToUser(input: {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
}) {
  const current = await authPrisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true, image: true, profilePictures: true },
  });
  if (!current) return;

  const profileUpdate: {
    email?: string;
    emailVerified?: boolean;
    name?: string;
    image?: string | null;
    profilePictures?: { push: string };
  } = {};

  if (
    input.email &&
    isPublishableUserEmail(input.email) &&
    isPlaceholderUserEmail(current.email)
  ) {
    profileUpdate.email = input.email;
    profileUpdate.emailVerified = input.emailVerified;
  }
  if (input.name && !current.name?.trim()) {
    profileUpdate.name = input.name;
  }
  if (input.image && !current.image) {
    profileUpdate.image = input.image;
  }
  if (input.image && !current.profilePictures.includes(input.image)) {
    profileUpdate.profilePictures = { push: input.image };
  }

  if (Object.keys(profileUpdate).length === 0) return;

  try {
    await authPrisma.user.update({
      where: { id: input.userId },
      data: profileUpdate,
    });
  } catch {
    // Unique email conflicts should not fail social login; VerifiedEmail still
    // holds the upstream mailbox for OAuth userinfo resolution.
  }
}

export async function syncSocialVerifiedEmailFromAccountHook(
  account: AccountHookPayload,
) {
  if (!SOCIAL_PROFILE_PROVIDERS.has(account.providerId)) return;

  const accountId = account.providerAccountId.trim();
  if (!accountId) return;

  const staged = consumeStagedSocialVerifiedEmail(
    account.providerId,
    accountId,
  );
  if (!staged) return;

  const email =
    staged.email && isPublishableUserEmail(staged.email)
      ? staged.email.trim()
      : null;
  if (email) {
    await upsertVerifiedEmail({
      userId: account.userId,
      provider: account.providerId,
      email,
    });
  }
  await applySocialVerifiedEmailToUser({
    userId: account.userId,
    email,
    emailVerified: staged.emailVerified,
    name: staged.name,
    image: staged.image,
  });
}

export function socialVerifiedEmailPlugin() {
  return {
    id: "life-ustc-social-verified-email",
    init() {
      return {
        options: {
          databaseHooks: {
            account: {
              create: {
                async after(account: Account) {
                  await syncSocialVerifiedEmailFromAccountHook(account);
                },
              },
              update: {
                async after(account: Account) {
                  await syncSocialVerifiedEmailFromAccountHook(account);
                },
              },
            },
          },
        },
      };
    },
  };
}
