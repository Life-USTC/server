import { prisma as defaultPrisma } from "@/lib/db/prisma";
import {
  getOAuthMcpResourceUrl,
  getOAuthProviderValidAudiences,
} from "@/lib/mcp/urls";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { hasMcpScope } from "@/lib/oauth/scope-registry";
import {
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

type DeviceAuthorizationClient = {
  grantTypes: string[];
  public: boolean | null;
  tokenEndpointAuthMethod: string | null;
  type: string | null;
};

type DeviceAuthorizationClientRecord = DeviceAuthorizationClient & {
  clientId: string;
  disabled: boolean;
  name: string | null;
  scopes: string[];
};

type DeviceAuthorizationPrisma = {
  oAuthClient: {
    findUnique: (input: {
      where: { clientId: string };
      select: {
        clientId: true;
        disabled: true;
        grantTypes: true;
        name: true;
        public: true;
        scopes: true;
        tokenEndpointAuthMethod: true;
        type: true;
      };
    }) => Promise<DeviceAuthorizationClientRecord | null>;
  };
};

export type OAuthDevicePolicyError = {
  error: string;
  errorDescription: string;
  status: number;
};

type DeviceAuthorizationClientResolution =
  | {
      client: DeviceAuthorizationClientRecord;
      requestedResources: string[];
      requestedScopes: string[];
    }
  | {
      error: OAuthDevicePolicyError;
      reason:
        | "confidential_client"
        | "invalid_client"
        | "invalid_resource"
        | "invalid_scope"
        | "unsupported_grant";
    };

export function getDeviceAuthorizationClientPolicyFailure(
  client: DeviceAuthorizationClient,
): "unsupported_grant" | "confidential_client" | null {
  if (!client.grantTypes.includes(OAUTH_DEVICE_CODE_GRANT_TYPE)) {
    return "unsupported_grant";
  }

  if (
    client.tokenEndpointAuthMethod === OAUTH_PUBLIC_CLIENT_AUTH_METHOD ||
    client.public === true ||
    client.type === "native" ||
    client.type === "public" ||
    client.type === "user-agent-based"
  ) {
    return null;
  }

  return "confidential_client";
}

export function resolveRequestedDeviceScopes(
  scope: FormDataEntryValue | null,
  allowedScopes: string[],
): { error: OAuthDevicePolicyError } | { scopes: string[] } {
  if (scope instanceof File) {
    return {
      error: {
        error: "invalid_request",
        errorDescription: "scope must be a string",
        status: 400,
      },
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
      error: {
        error: "invalid_scope",
        errorDescription: "Requested scope is not allowed for this client",
        status: 400,
      },
    };
  }

  return { scopes: [...new Set(requestedScopes)] };
}

export function resolveRequestedDeviceResources(
  resourceEntries: FormDataEntryValue[],
  requestedScopes: string[],
): { error: OAuthDevicePolicyError } | { resources: string[] } {
  const resources: string[] = [];
  const validAudiences = getOAuthProviderValidAudiences();

  for (const entry of resourceEntries) {
    if (entry instanceof File) {
      return {
        error: {
          error: "invalid_request",
          errorDescription: "resource must be a string",
          status: 400,
        },
      };
    }

    const value = entry.trim();
    if (!value) {
      return {
        error: {
          error: "invalid_target",
          errorDescription: "Requested resource is invalid",
          status: 400,
        },
      };
    }

    let normalized: string;
    try {
      normalized = normalizeResourceIndicator(value);
    } catch {
      return {
        error: {
          error: "invalid_target",
          errorDescription: "Requested resource is invalid",
          status: 400,
        },
      };
    }

    const matchedAudience = validAudiences.find((audience) =>
      resourceIndicatorsMatch(normalized, audience),
    );
    if (!matchedAudience) {
      return {
        error: {
          error: "invalid_target",
          errorDescription: "Requested resource is not allowed for this server",
          status: 400,
        },
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
    hasMcpScope(requestedScopes) &&
    !resources.some((resource) =>
      resourceIndicatorsMatch(resource, getOAuthMcpResourceUrl()),
    )
  ) {
    return {
      error: {
        error: "invalid_target",
        errorDescription:
          "An MCP scope requires the MCP resource indicator",
        status: 400,
      },
    };
  }

  return { resources };
}

export async function resolveDeviceAuthorizationClient({
  clientId,
  prisma = defaultPrisma,
  resourceEntries,
  scope,
}: {
  clientId: string;
  prisma?: DeviceAuthorizationPrisma;
  resourceEntries: FormDataEntryValue[];
  scope: FormDataEntryValue | null;
}): Promise<DeviceAuthorizationClientResolution> {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      clientId: true,
      disabled: true,
      grantTypes: true,
      name: true,
      public: true,
      scopes: true,
      tokenEndpointAuthMethod: true,
      type: true,
    },
  });

  if (!client || client.disabled) {
    return {
      error: {
        error: "invalid_client",
        errorDescription: "Unknown or disabled client",
        status: 400,
      },
      reason: "invalid_client",
    };
  }

  const policyFailure = getDeviceAuthorizationClientPolicyFailure(client);
  if (policyFailure) {
    return {
      error: {
        error: "unauthorized_client",
        errorDescription:
          policyFailure === "unsupported_grant"
            ? "Client is not registered for device authorization"
            : "Device authorization requires a public client",
        status: 400,
      },
      reason: policyFailure,
    };
  }

  const requestedScopesResult = resolveRequestedDeviceScopes(
    scope,
    client.scopes,
  );
  if ("error" in requestedScopesResult) {
    return { error: requestedScopesResult.error, reason: "invalid_scope" };
  }

  const requestedResourcesResult = resolveRequestedDeviceResources(
    resourceEntries,
    requestedScopesResult.scopes,
  );
  if ("error" in requestedResourcesResult) {
    return {
      error: requestedResourcesResult.error,
      reason: "invalid_resource",
    };
  }

  return {
    client,
    requestedResources: requestedResourcesResult.resources,
    requestedScopes: requestedScopesResult.scopes,
  };
}
