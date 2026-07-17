import { jsonResponse } from "@/lib/api/helpers";
import { observedApiRoute } from "@/lib/log/api-observability";
import { withBetterAuthOAuthDebug } from "@/lib/log/oauth-debug";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
import { OAUTH_DEVICE_CODE_GRANT_TYPE } from "@/lib/oauth/constants";
import { rewriteOAuthResourceAliases } from "@/lib/oauth/resource-aliases";
import { handleDeviceCodeGrant } from "./auth-token-device-grant";
import { maybeNormalizeTokenLoopbackRedirectRequest } from "./auth-token-loopback-normalization";
import { logObservedTokenRedirectRequest } from "./auth-token-observed-logging";
import { maybeBindOAuthRefreshResourceRequest } from "./auth-token-refresh-resource-binding";
import {
  persistOAuthRefreshTokenResources,
  replaceOAuthRefreshAccessToken,
  validateOAuthRefreshTokenResources,
} from "./auth-token-refresh-resources";
import { rewriteTokenFormRequest } from "./auth-token-request-rewrite";

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

async function runTokenHandler(run: () => Promise<Response | undefined>) {
  const response = await run();
  if (!response) {
    throw new Error("Token handler did not return a response");
  }
  return response;
}

async function runObservedTokenHandler(
  request: Request,
  params: URLSearchParams,
  run: () => Promise<Response | undefined>,
) {
  const start = Date.now();
  const url = new URL(request.url);
  const grantType = params.get("grant_type");
  try {
    const response = await runTokenHandler(run);
    writeOAuthEventAnalytics({
      durationMs: Date.now() - start,
      event: "token.response",
      grantType,
      hasResource: params.has("resource"),
      method: request.method,
      path: url.pathname,
      resourceCount: params.getAll("resource").length,
      status: response.status,
    });
    return response;
  } catch (err) {
    writeOAuthEventAnalytics({
      durationMs: Date.now() - start,
      event: "token.error",
      grantType,
      hasResource: params.has("resource"),
      method: request.method,
      path: url.pathname,
      resourceCount: params.getAll("resource").length,
      status: 500,
      statusReason: err instanceof Error ? err.name : "unknown",
    });
    throw err;
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

  const normalizedRequest = rewriteOAuthResourceAliases(params)
    ? rewriteTokenFormRequest(request, params)
    : request;

  if (params.get("grant_type") === OAUTH_DEVICE_CODE_GRANT_TYPE) {
    return runObservedTokenHandler(request, params, () =>
      handleDeviceCodeGrant(normalizedRequest, params),
    );
  }

  logObservedTokenRedirectRequest(normalizedRequest, params);

  return runObservedTokenHandler(request, params, async () => {
    const resourceError = await validateOAuthRefreshTokenResources(
      normalizedRequest,
      params,
    );
    if (resourceError) return resourceError;

    const delegatedRequest = await maybeBindOAuthRefreshResourceRequest(
      await maybeNormalizeTokenLoopbackRedirectRequest(
        normalizedRequest,
        params,
      ),
      params,
    );
    const delegatedResponse = await withBetterAuthOAuthDebug(
      "POST",
      delegatedRequest,
      authHandler,
    );
    const response = await replaceOAuthRefreshAccessToken(
      delegatedRequest,
      params,
      await normalizeOAuthTokenErrorResponse(delegatedResponse),
    );
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
