import type { SupportedOAuthClientAuthMethod } from "@/lib/oauth/constants";

export const ADMIN_OAUTH_CLIENT_PATTERNS: Record<
  SupportedOAuthClientAuthMethod,
  {
    enableEndSession: boolean;
    pattern: "confidential_connector" | "public_pkce" | "trusted_first_party";
    skipConsent: boolean;
  }
> = {
  client_secret_basic: {
    enableEndSession: true,
    pattern: "trusted_first_party",
    skipConsent: true,
  },
  client_secret_post: {
    enableEndSession: false,
    pattern: "confidential_connector",
    skipConsent: false,
  },
  none: {
    enableEndSession: false,
    pattern: "public_pkce",
    skipConsent: false,
  },
};

export function parseFormLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function getOAuthActionErrorMessage(error: unknown, fallback: string) {
  const errorMessage =
    error instanceof Error ? nonEmptyString(error.message) : null;
  if (errorMessage) return errorMessage;

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const recordMessage = nonEmptyString(record.message);
    if (recordMessage) return recordMessage;

    const body = record.body;
    if (body && typeof body === "object") {
      const bodyRecord = body as Record<string, unknown>;
      return (
        nonEmptyString(bodyRecord.error_description) ??
        nonEmptyString(bodyRecord.message) ??
        fallback
      );
    }
  }

  return fallback;
}
