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
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
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

async function runDeviceAuthorizationPostRoute(
  request: Request,
): Promise<Response> {
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
      errorName: getSafeErrorName(err),
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

async function postRoute(request: Request): Promise<Response> {
  const start = Date.now();
  const path = new URL(request.url).pathname;
  try {
    const response = await runDeviceAuthorizationPostRoute(request);
    writeOAuthEventAnalytics({
      durationMs: Date.now() - start,
      event: "device-authorization.response",
      method: request.method,
      path,
      status: response.status,
    });
    return response;
  } catch (err) {
    writeOAuthEventAnalytics({
      durationMs: Date.now() - start,
      event: "device-authorization.error",
      method: request.method,
      path,
      status: 500,
      statusReason: err instanceof Error ? err.name : "unknown",
    });
    throw err;
  }
}
export const deviceAuthorizationPostRoute = observedApiRoute(postRoute);
