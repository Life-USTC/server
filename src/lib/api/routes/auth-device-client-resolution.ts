import {
  deviceAuthJsonError,
  resolveRequestedDeviceResources,
  resolveRequestedDeviceScopes,
} from "@/lib/api/routes/auth-device-authorization-helpers";
import { getDeviceAuthorizationClientPolicyFailure } from "@/lib/api/routes/auth-device-client-policy";
import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

export async function resolveDeviceAuthorizationClient(
  request: Request,
  clientId: string,
  scope: FormDataEntryValue | null,
  resourceEntries: FormDataEntryValue[],
) {
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
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_client",
      clientIdPrefix: clientId.slice(0, 8),
    });
    return {
      response: deviceAuthJsonError(
        400,
        "invalid_client",
        "Unknown or disabled client",
      ),
    };
  }

  const policyFailure = getDeviceAuthorizationClientPolicyFailure(client);
  if (policyFailure) {
    logOAuthDebug("device-auth.reject", request, {
      reason: policyFailure,
      clientIdPrefix: clientId.slice(0, 8),
    });
    return {
      response: deviceAuthJsonError(
        400,
        "unauthorized_client",
        policyFailure === "unsupported_grant"
          ? "Client is not registered for device authorization"
          : "Device authorization requires a public client",
      ),
    };
  }

  const requestedScopesResult = resolveRequestedDeviceScopes(
    scope,
    client.scopes,
  );
  if ("error" in requestedScopesResult) {
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_scope",
      clientIdPrefix: clientId.slice(0, 8),
    });
    return { response: requestedScopesResult.error };
  }

  const requestedResourcesResult = resolveRequestedDeviceResources(
    resourceEntries,
    requestedScopesResult.scopes,
  );
  if ("error" in requestedResourcesResult) {
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_resource",
      clientIdPrefix: clientId.slice(0, 8),
    });
    return { response: requestedResourcesResult.error };
  }

  return {
    client,
    requestedResources: requestedResourcesResult.resources,
    requestedScopes: requestedScopesResult.scopes,
  };
}
