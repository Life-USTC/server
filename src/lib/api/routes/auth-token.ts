import { observedApiRoute } from "@/lib/log/api-observability";
import { withBetterAuthOAuthDebug } from "@/lib/log/oauth-debug";
import { recordOAuthTokenRequestMetric } from "@/lib/metrics/observability-metrics";
import { OAUTH_DEVICE_CODE_GRANT_TYPE } from "@/lib/oauth/constants";
import { handleDeviceCodeGrant } from "./auth-token-device-grant";
import {
  logObservedTokenRedirectRequest,
  maybeBindMcpRefreshRequest,
  maybeNormalizeTokenLoopbackRedirectRequest,
} from "./auth-token-normalization";

async function authHandler(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(request);
}

async function withTokenMetrics(
  params: URLSearchParams,
  run: () => Promise<Response | undefined>,
) {
  const start = Date.now();
  try {
    const response = await run();
    if (!response) {
      throw new Error("Token handler did not return a response");
    }
    recordOAuthTokenRequestMetric({
      grantType: params.get("grant_type"),
      hasResource: params.has("resource"),
      status: response.status,
      durationMs: Date.now() - start,
    });
    return response;
  } catch (error) {
    recordOAuthTokenRequestMetric({
      grantType: params.get("grant_type"),
      hasResource: params.has("resource"),
      status: 500,
      durationMs: Date.now() - start,
    });
    throw error;
  }
}

async function postRoute(request: Request) {
  const cloned = request.clone();

  let params: URLSearchParams;
  try {
    const body = await cloned.text();
    params = new URLSearchParams(body);
  } catch {
    // If body parsing fails, delegate to Better Auth
    return withBetterAuthOAuthDebug("POST", request, authHandler);
  }

  if (params.get("grant_type") === OAUTH_DEVICE_CODE_GRANT_TYPE) {
    return withTokenMetrics(params, () =>
      handleDeviceCodeGrant(request, params),
    );
  }

  logObservedTokenRedirectRequest(request, params);

  return withTokenMetrics(params, async () =>
    withBetterAuthOAuthDebug(
      "POST",
      await maybeBindMcpRefreshRequest(
        await maybeNormalizeTokenLoopbackRedirectRequest(request, params),
        params,
      ),
      authHandler,
    ),
  );
}
export const tokenPostRoute = observedApiRoute(postRoute);

function getRoute(request: Request) {
  return withBetterAuthOAuthDebug("GET", request, authHandler);
}
export const tokenGetRoute = observedApiRoute(getRoute);
