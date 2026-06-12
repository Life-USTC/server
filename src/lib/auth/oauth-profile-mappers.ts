import type {
  GithubProfile,
  GoogleProfile,
  OAuthProfile,
} from "@/lib/auth/oauth-profile-types";
import {
  fallbackEmail,
  firstBooleanValue,
  firstProfileName,
  firstStringValue,
  profileEmail,
  profileImage,
  profileName,
} from "@/lib/auth/oauth-profile-values";

export function mapOidcProfileToUser(profile: OAuthProfile) {
  const accountId = firstStringValue(profile, ["sub", "id", "user_id"]);
  if (!accountId) {
    throw new Error("OIDC profile is missing a stable account identifier");
  }

  const email = profileEmail(profile.email);
  const emailVerified = firstBooleanValue(profile, [
    "email_verified",
    "emailVerified",
  ]);
  const displayName =
    firstProfileName(profile, [
      "name",
      "preferred_username",
      "nickname",
      "email",
    ]) ?? `USTC User ${accountId}`;

  return {
    id: accountId,
    email: email ?? fallbackEmail("oidc", accountId),
    name: displayName,
    image: profileImage(profile.picture),
    emailVerified: Boolean(email && emailVerified),
  };
}

export function mapGithubProfileToUser(profile: GithubProfile) {
  const email = profileEmail(profile.email);
  return {
    email: email ?? fallbackEmail("github", profile.id),
    name: profileName(profile.name ?? profile.login),
    image: profileImage(profile.avatar_url),
    // GitHub may return unverified or hidden emails; do not mark
    // fallback/local emails as verified.
    emailVerified: false,
  };
}

export function mapGoogleProfileToUser(profile: GoogleProfile) {
  const email = profileEmail(profile.email);
  return {
    email: email ?? fallbackEmail("google", profile.sub),
    name: profileName(profile.name),
    image: profileImage(profile.picture),
    emailVerified:
      email !== null && typeof profile.email_verified === "boolean"
        ? profile.email_verified
        : false,
  };
}
