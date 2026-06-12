import type { OAuthProfile } from "@/lib/auth/oauth-profile-types";

export const profileImage = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const profileName = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

export const fallbackEmail = (provider: string, accountId: unknown): string =>
  `${provider}-${String(accountId)}@users.local`;

export const profileEmail = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const firstStringValue = (
  profile: OAuthProfile,
  keys: readonly string[],
) => {
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

export function firstBooleanValue(
  profile: OAuthProfile,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

export function firstProfileName(
  profile: OAuthProfile,
  keys: readonly string[],
) {
  for (const key of keys) {
    const name = profileName(profile[key]);
    if (name) {
      return name;
    }
  }
  return null;
}
