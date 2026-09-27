import type {
  GithubProfile,
  GoogleProfile,
  OAuthProfile,
} from "@/lib/auth/oauth-profile-types";
import {
  fallbackEmail,
  firstStringValue,
  profileEmail,
  profileImage,
} from "@/lib/auth/oauth-profile-values";
import { isPublishableUserEmail } from "@/lib/auth/oauth-user-email";
import { stageSocialVerifiedEmail } from "@/lib/auth/social-verified-email-staging";

export function mapOidcProfileToUser(profile: OAuthProfile) {
  const accountId = getOidcAccountSubject(profile);

  // USTC passport does not expose a real mailbox; keep a local unique email for
  // Better Auth and ignore passport fake_email placeholders.
  const image = profileImage(profile.picture);
  stageSocialVerifiedEmail({
    provider: "oidc",
    accountId,
    email: null,
    emailVerified: false,
    image: image ?? null,
  });

  return {
    email: fallbackEmail("oidc", accountId),
    name: "",
    image,
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
  stageSocialVerifiedEmail({
    provider: "github",
    accountId: String(profile.id),
    email: isPublishableUserEmail(email) ? email : null,
    // GitHub user:email returns account mailboxes; treat as verified for
    // OAuth client publication once stored in VerifiedEmail.
    emailVerified: isPublishableUserEmail(email),
    image: profileImage(profile.avatar_url) ?? null,
  });

  return {
    email: email ?? fallbackEmail("github", profile.id),
    name: "",
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

  stageSocialVerifiedEmail({
    provider: "google",
    accountId: profile.sub,
    email: isPublishableUserEmail(email) && emailVerified ? email : null,
    emailVerified,
    image: profileImage(profile.picture) ?? null,
  });

  return {
    email: email ?? fallbackEmail("google", profile.sub),
    name: "",
    image: profileImage(profile.picture),
    emailVerified,
  };
}
