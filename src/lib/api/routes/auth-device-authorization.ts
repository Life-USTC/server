import { resolveDeviceAuthorizationClient } from "@/features/oauth/server/device-authorization-policy.server";
import { createDeviceAuthorizationGrant } from "@/features/oauth/server/device-grant-policy.server";
import { jsonResponse } from "@/lib/api/helpers";
import {
  DEVICE_AUTH_CORS_HEADERS,
  deviceAuthJsonError,
} from "@/lib/api/routes/auth-device-authorization-helpers";
import { parseDeviceAuthorizationForm } from "@/lib/api/routes/auth-device-form-parsing";
import { observedApiRoute } from "@/lib/log/api-observability";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import {
  DEVICE_CODE_EXPIRES_IN,
  DEVICE_CODE_POLL_INTERVAL,
  getVerificationUri,
  getVerificationUriComplete,
} from "@/lib/oauth/device-code";
import { getPublicOrigin } from "@/lib/site-url";

function optionsRoute() {
  return new Response(null, { status: 204, headers: DEVICE_AUTH_CORS_HEADERS });
}
export const deviceAuthorizationOptionsRoute = observedApiRoute(optionsRoute);

async function postRoute(request: Request): Promise<Response> {
  logOAuthDebug("device-auth.request", request, {
    path: new URL(request.url).pathname,
  });

  const parsedForm = await parseDeviceAuthorizationForm(request);
  if ("response" in parsedForm) return parsedForm.response as Response;

  const resolvedClient = await resolveDeviceAuthorizationClient({
    clientId: parsedForm.clientId,
    scope: parsedForm.scope,
    resourceEntries: parsedForm.resourceEntries,
  });
  if ("error" in resolvedClient) {
    logOAuthDebug("device-auth.reject", request, {
      reason: resolvedClient.reason,
      clientIdPrefix: parsedForm.clientId.slice(0, 8),
    });
    return deviceAuthJsonError(
      resolvedClient.error.status,
      resolvedClient.error.error,
      resolvedClient.error.errorDescription,
    );
  }

  let grant: Awaited<ReturnType<typeof createDeviceAuthorizationGrant>>;
  try {
    grant = await createDeviceAuthorizationGrant({
      clientId: resolvedClient.client.clientId,
      requestedScopes: resolvedClient.requestedScopes,
      requestedResources: resolvedClient.requestedResources,
    });
  } catch (err) {
    logOAuthDebug("device-auth.error", request, {
      reason: "prisma_create_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return deviceAuthJsonError(
      500,
      "server_error",
      "Failed to create device code",
    );
  }

  const siteOrigin = getPublicOrigin();

  logOAuthDebug("device-auth.success", request, {
    clientIdPrefix: parsedForm.clientId.slice(0, 8),
    resourceCount: resolvedClient.requestedResources.length,
    userCodePrefix: grant.userCode.slice(0, 4),
    scopeCount: resolvedClient.requestedScopes.length,
  });

  return jsonResponse(
    {
      device_code: grant.deviceCode,
      user_code: grant.userCode,
      verification_uri: getVerificationUri(siteOrigin),
      verification_uri_complete: getVerificationUriComplete(
        siteOrigin,
        grant.userCode,
      ),
      expires_in: DEVICE_CODE_EXPIRES_IN,
      interval: DEVICE_CODE_POLL_INTERVAL,
    },
    { headers: DEVICE_AUTH_CORS_HEADERS },
  );
}
export const deviceAuthorizationPostRoute = observedApiRoute(postRoute);
