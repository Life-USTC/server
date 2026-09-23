import type { Account } from "@better-auth/core/db";
import type { UstcOidcIdentityClaims } from "@/features/settings/lib/ustc-identity";
import { OIDC_PROVIDER_ID } from "@/lib/auth/provider-ids";
import { withUserDbContext } from "@/lib/db/prisma";

type SyncUstcOidcIdentityInput = UstcOidcIdentityClaims & {
  userId: string;
};

function normalizeOptionalIdentityValue(value: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
}

type AccountIdentityHookPayload = Pick<
  Account,
  "accountId" | "providerId" | "userId"
>;

export async function syncUstcOidcIdentityFromAccountHook(
  account: AccountIdentityHookPayload,
  stagedClaims: UstcOidcIdentityClaims | null,
) {
  if (account.providerId !== OIDC_PROVIDER_ID) return;

  const upstreamUid = account.accountId.trim();
  if (!upstreamUid) return;

  await syncUstcOidcIdentity({
    userId: account.userId,
    upstreamUid,
    gid: stagedClaims?.gid ?? null,
    sno: stagedClaims?.sno ?? null,
  });
}
