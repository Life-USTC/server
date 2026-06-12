import { getOptionalTrimmedEnv } from "@/app-env";

function resolveLocalHostForOrigin(host: string) {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

function getDefaultLocalOrigin() {
  const host = resolveLocalHostForOrigin("localhost");
  return `http://${host}:3000`;
}

const DEFAULT_LOCAL_ORIGIN = getDefaultLocalOrigin();

function normalizeAbsoluteOrigin(value: string, envName: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${envName} must be a valid absolute URL`);
  }
}

function getAbsoluteOriginEnv(envName: string) {
  const value = getOptionalTrimmedEnv(envName);
  if (!value) return undefined;
  return normalizeAbsoluteOrigin(value, envName);
}

/**
 * Public origin of the current deployment. Production sets APP_PUBLIC_ORIGIN;
 * local development falls back to the pinned localhost origin.
 */
export function getPublicOrigin(): string {
  return getAbsoluteOriginEnv("APP_PUBLIC_ORIGIN") ?? DEFAULT_LOCAL_ORIGIN;
}

/**
 * Canonical origin follows the public origin; keep one production URL setting.
 */
export function getCanonicalOrigin(): string {
  return getPublicOrigin();
}

export function getBetterAuthBaseUrl(): string {
  return `${getPublicOrigin()}/api/auth`;
}
