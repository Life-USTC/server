import { extractUstcOidcProfileEmail } from "@/features/settings/lib/ustc-identity";
import type {
  GithubProfile,
  GoogleProfile,
  OAuthProfile,
} from "@/lib/auth/oauth-profile-types";
import {
  fallbackEmail,
  firstProfileName,
  firstStringValue,
  profileEmail,
  profileImage,
  profileName,
} from "@/lib/auth/oauth-profile-values";

export function mapOidcProfileToUser(profile: OAuthProfile) {
  const accountId = getOidcAccountSubject(profile);
  const { email: realEmail, emailVerified } =
    extractUstcOidcProfileEmail(profile);

  const displayName =
    firstProfileName(profile, [
      "name",
      "preferred_username",
      "nickname",
      "email",
    ]) ?? `USTC User ${accountId}`;

  return {
    // Keep Better Auth's required unique email local when upstream only
    // supplies passport fake_email placeholders.
    email: realEmail ?? fallbackEmail("oidc", accountId),
    name: displayName,
    image: profileImage(profile.picture),
    emailVerified: Boolean(realEmail && emailVerified),
  };
}

export function getOidcAccountSubject(profile: OAuthProfile) {
  const accountId = firstStringValue(profile, ["sub", "id", "user_id"]);
  if (!accountId) {
    throw new Error("OIDC profile is missing a stable account identifier");
  }
  return accountId;
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
