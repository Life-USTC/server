import { jsonResponse } from "@/lib/api/helpers";
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
import {
  persistOAuthRefreshTokenResources,
  validateOAuthRefreshTokenResources,
} from "./auth-token-refresh-resources";

async function authHandler(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(request);
}

function getOAuthErrorCode(status: number, body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  if (status === 401) return "invalid_client";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

function getOAuthErrorDescription(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  if (
    "error_description" in body &&
    typeof body.error_description === "string"
  ) {
    return body.error_description;
  }
  if ("message" in body && typeof body.message === "string") {
    return body.message;
  }
  return undefined;
}

async function parseJsonBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;

  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}

async function normalizeOAuthTokenErrorResponse(response: Response) {
  if (response.ok) return response;

  const body = await parseJsonBody(response);
  const error_description = getOAuthErrorDescription(body);
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "application/json; charset=utf-8");

  return jsonResponse(
    {
      error: getOAuthErrorCode(response.status, body),
      ...(error_description ? { error_description } : {}),
    },
    { status: response.status, statusText: response.statusText, headers },
  );
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
    return normalizeOAuthTokenErrorResponse(
      await withBetterAuthOAuthDebug("POST", request, authHandler),
    );
  }

  if (params.get("grant_type") === OAUTH_DEVICE_CODE_GRANT_TYPE) {
    return withTokenMetrics(params, () =>
      handleDeviceCodeGrant(request, params),
    );
  }

  logObservedTokenRedirectRequest(request, params);

  return withTokenMetrics(params, async () => {
    const resourceError = await validateOAuthRefreshTokenResources(
      request,
      params,
    );
    if (resourceError) return resourceError;

    const delegatedRequest = await maybeBindMcpRefreshRequest(
      await maybeNormalizeTokenLoopbackRedirectRequest(request, params),
      params,
    );
    const delegatedResponse = await withBetterAuthOAuthDebug(
      "POST",
      delegatedRequest,
      authHandler,
    );
    const response = await normalizeOAuthTokenErrorResponse(delegatedResponse);
    await persistOAuthRefreshTokenResources(delegatedRequest, params, response);
    return response;
  });
}
export const tokenPostRoute = observedApiRoute(postRoute);

function getRoute() {
  return jsonResponse(
    {
      error: "invalid_request",
      error_description: "Use POST to exchange OAuth grants.",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
export const tokenGetRoute = observedApiRoute(getRoute);
