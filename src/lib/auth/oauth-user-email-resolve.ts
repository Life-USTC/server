import {
  isPlaceholderUserEmail,
  isPublishableUserEmail,
} from "@/lib/auth/oauth-user-email";
import { OIDC_PROVIDER_ID } from "@/lib/auth/provider-ids";
import { authPrisma } from "@/lib/db/auth-prisma";

export type ResolvedOAuthUserEmail = {
  email: string;
  emailVerified: boolean;
  source: "verified-email" | "user-email";
};

/**
 * Prefer a stored upstream VerifiedEmail over User.email. Never surfaces
 * `@users.local` / passport fake placeholders to OAuth clients.
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

  const preferredVerified =
    verifiedCandidates.find(
      (row) =>
        row.provider === OIDC_PROVIDER_ID && isPublishableUserEmail(row.email),
    ) ?? verifiedCandidates.find((row) => isPublishableUserEmail(row.email));

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
