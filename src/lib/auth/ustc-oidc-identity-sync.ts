import type { Account } from "@better-auth/core/db";
import type { UstcOidcIdentityClaims } from "@/features/settings/lib/ustc-identity";
import { isPublishableUserEmail } from "@/lib/auth/oauth-user-email";
import { upsertVerifiedEmail } from "@/lib/auth/oauth-user-email-resolve";
import { OIDC_PROVIDER_ID } from "@/lib/auth/provider-ids";
import { authPrisma } from "@/lib/db/auth-prisma";
import { withUserDbContext } from "@/lib/db/prisma";

type SyncUstcOidcIdentityInput = UstcOidcIdentityClaims & {
  userId: string;
};

function normalizeOptionalIdentityValue(value: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function syncUstcOidcVerifiedProfile(input: SyncUstcOidcIdentityInput) {
  const email = isPublishableUserEmail(input.email) ? input.email.trim() : null;
  if (email) {
    await upsertVerifiedEmail({
      userId: input.userId,
      provider: OIDC_PROVIDER_ID,
      email,
    });
  }

  const profileUpdate: {
    email?: string;
    emailVerified?: boolean;
    name?: string;
    image?: string | null;
  } = {};

  if (email) {
    profileUpdate.email = email;
    profileUpdate.emailVerified = input.emailVerified;
  }
  if (input.name) {
    profileUpdate.name = input.name;
  }
  if (input.picture) {
    profileUpdate.image = input.picture;
  }

  if (Object.keys(profileUpdate).length === 0) return;

  try {
    await authPrisma.user.update({
      where: { id: input.userId },
      data: profileUpdate,
    });
  } catch {
    // Unique email conflicts should not fail the whole OIDC login; VerifiedEmail
    // still holds the upstream mailbox for OAuth userinfo resolution.
  }
}

export async function syncUstcOidcIdentity(input: SyncUstcOidcIdentityInput) {
  const upstreamUid = input.upstreamUid.trim();
  if (!upstreamUid) return;

  const gid = normalizeOptionalIdentityValue(input.gid);
  const sno = normalizeOptionalIdentityValue(input.sno);

  await withUserDbContext(input.userId, async (tx) => {
    await tx.userUstcIdentity.upsert({
      where: {
        userId_upstreamUid: {
          userId: input.userId,
          upstreamUid,
        },
      },
      create: {
        userId: input.userId,
        upstreamUid,
        gid,
        sno,
      },
      update: {
        ...(gid ? { gid } : {}),
        ...(sno ? { sno } : {}),
      },
    });
  });

  await syncUstcOidcVerifiedProfile(input);
}

type AccountIdentityHookPayload = Pick<
  Account,
  "providerId" | "providerAccountId" | "userId"
>;

export async function syncUstcOidcIdentityFromAccountHook(
  account: AccountIdentityHookPayload,
  stagedClaims: UstcOidcIdentityClaims | null,
) {
  if (account.providerId !== OIDC_PROVIDER_ID) return;

  const upstreamUid = account.providerAccountId.trim();
  if (!upstreamUid) return;

  await syncUstcOidcIdentity({
    userId: account.userId,
    upstreamUid,
    gid: stagedClaims?.gid ?? null,
    sno: stagedClaims?.sno ?? null,
    email: stagedClaims?.email ?? null,
    emailVerified: stagedClaims?.emailVerified ?? false,
    name: stagedClaims?.name ?? null,
    picture: stagedClaims?.picture ?? null,
  });
}
