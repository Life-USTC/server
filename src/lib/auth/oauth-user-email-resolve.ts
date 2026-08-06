import {
  isPlaceholderUserEmail,
  isPublishableUserEmail,
} from "@/lib/auth/oauth-user-email";
import { authPrisma } from "@/lib/db/auth-prisma";

export type ResolvedOAuthUserEmail = {
  email: string;
  emailVerified: boolean;
  source: "verified-email" | "user-email";
};

const SOCIAL_VERIFIED_EMAIL_PROVIDER_PRIORITY = ["google", "github"] as const;

/**
 * Prefer a stored GitHub/Google VerifiedEmail over User.email. Never surfaces
 * `@users.local` / passport fake placeholders to OAuth clients. USTC OIDC does
 * not provide real mailboxes, so oidc VerifiedEmail rows are ignored.
 */
export async function resolveOAuthUserEmail(input: {
  userId: string;
  userEmail?: string | null;
  userEmailVerified?: boolean | null;
}): Promise<ResolvedOAuthUserEmail | null> {
  const verifiedCandidates = await authPrisma.verifiedEmail.findMany({
    where: { userId: input.userId },
    orderBy: { updatedAt: "desc" },
    select: { email: true, provider: true },
  });

  const preferredVerified = SOCIAL_VERIFIED_EMAIL_PROVIDER_PRIORITY.map(
    (provider) =>
      verifiedCandidates.find(
        (row) => row.provider === provider && isPublishableUserEmail(row.email),
      ),
  ).find((row) => row != null);

  if (preferredVerified) {
    return {
      email: preferredVerified.email.trim(),
      emailVerified: true,
      source: "verified-email",
    };
  }

  if (isPublishableUserEmail(input.userEmail)) {
    return {
      email: input.userEmail.trim(),
      emailVerified: Boolean(input.userEmailVerified),
      source: "user-email",
    };
  }

  if (isPlaceholderUserEmail(input.userEmail)) {
    return null;
  }

  return null;
}

export async function upsertVerifiedEmail(input: {
  userId: string;
  provider: string;
  email: string;
}) {
  if (!isPublishableUserEmail(input.email)) return null;

  const email = input.email.trim();
  return authPrisma.verifiedEmail.upsert({
    where: {
      provider_email: {
        provider: input.provider,
        email,
      },
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      email,
    },
    update: {
      userId: input.userId,
    },
  });
}
