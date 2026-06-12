import { jsonResponse } from "@/lib/api/helpers";

export const DEVICE_AUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function deviceAuthJsonError(
  status: number,
  error: string,
  error_description: string,
) {
  return jsonResponse(
    { error, error_description },
    {
      status,
      headers: DEVICE_AUTH_CORS_HEADERS,
    },
  );
}

export function resolveRequestedDeviceScopes(
  scope: FormDataEntryValue | null,
  allowedScopes: string[],
): { error: Response } | { scopes: string[] } {
  if (scope instanceof File) {
    return {
      error: deviceAuthJsonError(
        400,
        "invalid_request",
        "scope must be a string",
      ),
    };
  }

  const requestedScopes =
    typeof scope === "string" && scope.trim().length > 0
      ? scope.trim().split(/\s+/)
      : allowedScopes;

  const allowed = new Set(allowedScopes);
  const invalidScopes = requestedScopes.filter((value) => !allowed.has(value));
  if (invalidScopes.length > 0) {
    return {
      error: deviceAuthJsonError(
        400,
        "invalid_scope",
        "Requested scope is not allowed for this client",
      ),
    };
  }

  return { scopes: [...new Set(requestedScopes)] };
}
