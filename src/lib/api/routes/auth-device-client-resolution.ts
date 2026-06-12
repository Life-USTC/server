import {
  deviceAuthJsonError,
  resolveRequestedDeviceScopes,
} from "@/lib/api/routes/auth-device-authorization-helpers";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

export async function resolveDeviceAuthorizationClient(
  request: Request,
  clientId: string,
  scope: FormDataEntryValue | null,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { clientId: true, disabled: true, scopes: true, name: true },
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

  return { client, requestedScopes: requestedScopesResult.scopes };
}
