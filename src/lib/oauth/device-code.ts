import { randomBytesBase64Url, randomInt } from "@/lib/crypto/web-crypto";

/** RFC 8628 device authorization grant constants and helpers. */

/** Device code expiry in seconds. */
export const DEVICE_CODE_EXPIRES_IN = 1800;

/** Minimum polling interval in seconds. */
export const DEVICE_CODE_POLL_INTERVAL = 5;

/** Device code status values. */
export const DEVICE_CODE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
} as const;

/** RFC 8628 error codes for token endpoint responses. */
export const DEVICE_CODE_ERRORS = {
  AUTHORIZATION_PENDING: "authorization_pending",
  SLOW_DOWN: "slow_down",
  EXPIRED_TOKEN: "expired_token",
  ACCESS_DENIED: "access_denied",
} as const;

/**
 * Generate a cryptographically random device code (opaque, high entropy).
 * 32 bytes → 43-char base64url string.
 */
export function generateDeviceCode(): string {
  return randomBytesBase64Url(32);
}

/**
 * Generate a user-friendly 8-character code formatted as XXXX-XXXX.
 * Uses uppercase letters (excluding ambiguous O/I/L) and digits (excluding 0/1).
 */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function generateUserCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) {
    chars.push(USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]);
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/**
 * Normalize a user-entered code for comparison: uppercase, strip whitespace/hyphens.
 * Then re-format as XXXX-XXXX.
 */
export function normalizeUserCode(input: string): string {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Build the verification URI for the device flow.
 */
export function getVerificationUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/oauth/device`;
}

/**
 * Build the complete verification URI with the user code pre-filled.
 */
export function getVerificationUriComplete(
  baseUrl: string,
  userCode: string,
): string {
  const params = new URLSearchParams({
    code: userCode,
    step: "approve",
  });
  return `${getVerificationUri(baseUrl)}?${params.toString()}`;
}
