type OAuthProfile = Record<string, unknown>;

type GithubProfile = {
  email?: string | null;
  id: string;
  name?: string;
  login?: string;
  avatar_url?: string;
};

type GoogleProfile = {
  email?: string;
  sub: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

const profileImage = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const profileName = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

const fallbackEmail = (provider: string, accountId: unknown): string =>
  `${provider}-${String(accountId)}@users.local`;

const profileEmail = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const firstStringValue = (profile: OAuthProfile, keys: readonly string[]) => {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

function firstBooleanValue(profile: OAuthProfile, keys: readonly string[]) {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

function firstProfileName(profile: OAuthProfile, keys: readonly string[]) {
  for (const key of keys) {
    const name = profileName(profile[key]);
    if (name) {
      return name;
    }
  }
  return null;
}

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
