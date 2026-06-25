import { jsonResponse } from "@/lib/api/helpers";
import {
  getOAuthMcpResourceUrl,
  getOAuthProviderValidAudiences,
} from "@/lib/mcp/urls";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
} from "@/lib/oauth/constants";
import {
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

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

  const allowed = new Set(allowedScopes);
  const requestedScopes =
    typeof scope === "string" && scope.trim().length > 0
      ? scope.trim().split(/\s+/)
      : DEFAULT_OAUTH_CLIENT_SCOPES.filter((value) => allowed.has(value));

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

export function resolveRequestedDeviceResources(
  resourceEntries: FormDataEntryValue[],
  requestedScopes: string[],
): { error: Response } | { resources: string[] } {
  const resources: string[] = [];
  const validAudiences = getOAuthProviderValidAudiences();

  for (const entry of resourceEntries) {
    if (entry instanceof File) {
      return {
        error: deviceAuthJsonError(
          400,
          "invalid_request",
          "resource must be a string",
        ),
      };
    }

    const value = entry.trim();
    if (!value) {
      return {
        error: deviceAuthJsonError(
          400,
          "invalid_target",
          "Requested resource is invalid",
        ),
      };
    }

    let normalized: string;
    try {
      normalized = normalizeResourceIndicator(value);
    } catch {
      return {
        error: deviceAuthJsonError(
          400,
          "invalid_target",
          "Requested resource is invalid",
        ),
      };
    }

    const matchedAudience = validAudiences.find((audience) =>
      resourceIndicatorsMatch(normalized, audience),
    );
    if (!matchedAudience) {
      return {
        error: deviceAuthJsonError(
          400,
          "invalid_target",
          "Requested resource is not allowed for this server",
        ),
      };
    }

    if (
      !resources.some((resource) =>
        resourceIndicatorsMatch(resource, matchedAudience),
      )
    ) {
      resources.push(matchedAudience);
    }
  }

  if (
    requestedScopes.includes(MCP_TOOLS_SCOPE) &&
    !resources.some((resource) =>
      resourceIndicatorsMatch(resource, getOAuthMcpResourceUrl()),
    )
  ) {
    return {
      error: deviceAuthJsonError(
        400,
        "invalid_target",
        "The mcp:tools scope requires the MCP resource indicator",
      ),
    };
  }

  return { resources };
}
