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
import { isPublishableUserEmail } from "@/lib/auth/oauth-user-email";
import { stageSocialVerifiedEmail } from "@/lib/auth/social-verified-email-staging";

export function mapOidcProfileToUser(profile: OAuthProfile) {
  const accountId = getOidcAccountSubject(profile);

  // USTC passport does not expose a real mailbox; keep a local unique email for
  // Better Auth and ignore passport fake_email placeholders.
  const displayName =
    firstProfileName(profile, [
      "name",
      "preferred_username",
      "nickname",
      "email",
    ]) ?? `USTC User ${accountId}`;

  return {
    email: fallbackEmail("oidc", accountId),
    name: displayName,
    image: profileImage(profile.picture),
    emailVerified: false,
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
  if (isPublishableUserEmail(email)) {
    stageSocialVerifiedEmail({
      provider: "github",
      accountId: String(profile.id),
      email,
      // GitHub user:email returns account mailboxes; treat as verified for
      // OAuth client publication once stored in VerifiedEmail.
      emailVerified: true,
      name: profileName(profile.name ?? profile.login) || null,
      image: profileImage(profile.avatar_url) ?? null,
    });
  }

  return {
    email: email ?? fallbackEmail("github", profile.id),
    name: profileName(profile.name ?? profile.login),
    image: profileImage(profile.avatar_url),
    emailVerified: false,
  };
}

export function mapGoogleProfileToUser(profile: GoogleProfile) {
  const email = profileEmail(profile.email);
  const emailVerified =
    email !== null && typeof profile.email_verified === "boolean"
      ? profile.email_verified
      : false;

  if (isPublishableUserEmail(email) && emailVerified) {
    stageSocialVerifiedEmail({
      provider: "google",
      accountId: profile.sub,
      email,
      emailVerified: true,
      name: profileName(profile.name) || null,
      image: profileImage(profile.picture) ?? null,
    });
  }

  return {
    email: email ?? fallbackEmail("google", profile.sub),
    name: profileName(profile.name),
    image: profileImage(profile.picture),
    emailVerified,
  };
}
