import type { OAuthProfile } from "@/lib/auth/oauth-profile-types";
import {
  firstBooleanValue,
  firstStringValue,
  profileEmail,
  profileImage,
  profileName,
} from "@/lib/auth/oauth-profile-values";
import { isPublishableUserEmail } from "@/lib/auth/oauth-user-email";

export type UstcOidcIdentityClaims = {
  upstreamUid: string;
  gid: string | null;
  sno: string | null;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
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

export function extractUstcOidcProfileEmail(profile: OAuthProfile) {
  // Only the real `email` claim is publishable. Passport `fake_email` is a
  // placeholder when the upstream email scope was not granted.
  const email = profileEmail(profile.email);
  if (!isPublishableUserEmail(email)) {
    return { email: null, emailVerified: false };
  }

  const emailVerified = firstBooleanValue(profile, [
    "email_verified",
    "emailVerified",
  ]);
  return { email, emailVerified };
}

export function extractUstcOidcIdentityClaims(
  profile: OAuthProfile,
  upstreamUid: string,
): UstcOidcIdentityClaims {
  const gid = firstStringValue(profile, ["gid"]);
  const sno = firstStringValue(profile, ["sno"]);
  const { email, emailVerified } = extractUstcOidcProfileEmail(profile);
  const name =
    profileName(profile.name) ||
    profileName(profile.preferred_username) ||
    profileName(profile.nickname) ||
    null;
  const picture = profileImage(profile.picture) ?? null;

  return {
    upstreamUid,
    gid,
    sno,
    email,
    emailVerified,
    name,
    picture,
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
