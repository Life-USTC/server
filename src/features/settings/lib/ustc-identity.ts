import type { OAuthProfile } from "@/lib/auth/oauth-profile-types";
import { firstStringValue } from "@/lib/auth/oauth-profile-values";

export type UstcOidcIdentityClaims = {
  upstreamUid: string;
  gid: string | null;
  sno: string | null;
};

export type UserUstcIdentityRecord = {
  upstreamUid: string;
  gid: string | null;
  sno: string | null;
  firstSeenAt: Date;
  lastSyncedAt: Date;
};

export type UserUstcIdentitySummary = {
  upstreamUids: string[];
  records: UserUstcIdentityRecord[];
};

export function extractUstcOidcIdentityClaims(
  profile: OAuthProfile,
  upstreamUid: string,
): UstcOidcIdentityClaims {
  const gid = firstStringValue(profile, ["gid"]);
  const sno = firstStringValue(profile, ["sno"]);

  return {
    upstreamUid,
    gid,
    sno,
  };
}

export function buildUserUstcIdentitySummary(
  records: UserUstcIdentityRecord[],
): UserUstcIdentitySummary {
  const sorted = [...records].sort((left, right) => {
    const syncedDiff =
      right.lastSyncedAt.getTime() - left.lastSyncedAt.getTime();
    if (syncedDiff !== 0) return syncedDiff;
    return left.upstreamUid.localeCompare(right.upstreamUid);
  });

  return {
    upstreamUids: sorted.map((record) => record.upstreamUid),
    records: sorted,
  };
}
