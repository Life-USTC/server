import { getOptionalTrimmedEnv } from "@/env";

const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

function normalizeAbsoluteOrigin(value: string, envName: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${envName} must be a valid absolute URL`);
  }
}

function normalizeVercelHost(value: string, envName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${envName} must not be blank`);
  }
  return normalizeAbsoluteOrigin(`https://${trimmed}`, envName);
}

function getAbsoluteOriginEnv(envName: string) {
  const value = getOptionalTrimmedEnv(envName);
  if (!value) return undefined;
  return normalizeAbsoluteOrigin(value, envName);
}

function getVercelOriginEnv(envName: string) {
  const value = getOptionalTrimmedEnv(envName);
  if (!value) return undefined;
  return normalizeVercelHost(value, envName);
}

/**
 * Public origin of the current deployment. Prefer explicit configuration, then
 * fall back to Vercel runtime metadata, then localhost for local development.
 */
export function getPublicOrigin(): string {
  return (
    getAbsoluteOriginEnv("APP_PUBLIC_ORIGIN") ??
    getVercelOriginEnv("VERCEL_URL") ??
    DEFAULT_LOCAL_ORIGIN
  );
}

/**
 * Canonical production origin for SEO and stable metadata. Vercel provides the
 * production host even in previews, which is a useful fallback when unset.
 */
export function getCanonicalOrigin(): string {
  return (
    getAbsoluteOriginEnv("APP_CANONICAL_ORIGIN") ??
    getVercelOriginEnv("VERCEL_PROJECT_PRODUCTION_URL") ??
    getPublicOrigin()
  );
}

export function getBetterAuthBaseUrl(): string {
  return `${getPublicOrigin()}/api/auth`;
}
