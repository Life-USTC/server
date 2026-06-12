import { jsonResponse } from "@/lib/api/helpers";
import {
  createDeviceAuthorizationGrant,
  parseDeviceAuthorizationForm,
  resolveDeviceAuthorizationClient,
} from "@/lib/api/routes/auth-device-authorization-flow";
import { DEVICE_AUTH_CORS_HEADERS } from "@/lib/api/routes/auth-device-authorization-helpers";
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

  const resolvedClient = await resolveDeviceAuthorizationClient(
    request,
    parsedForm.clientId,
    parsedForm.scope,
  );
  if ("response" in resolvedClient) return resolvedClient.response as Response;

  const grant = await createDeviceAuthorizationGrant(
    request,
    resolvedClient.client.clientId,
    resolvedClient.requestedScopes,
  );
  if ("response" in grant) return grant.response as Response;

  const siteOrigin = getPublicOrigin();

  logOAuthDebug("device-auth.success", request, {
    clientIdPrefix: parsedForm.clientId.slice(0, 8),
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
