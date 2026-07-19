import {
  issueResourceBoundRefreshAccessToken,
  persistRefreshTokenResources,
  validateRefreshTokenResources,
} from "@/features/oauth/server/refresh-token-resources.server";
import { jsonResponse } from "@/lib/api/helpers";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { OAUTH_REFRESH_TOKEN_GRANT_TYPE } from "@/lib/oauth/constants";

function invalidRefreshResourceResponse(error_description: string) {
  return jsonResponse(
    {
      error: "invalid_target",
      error_description,
    },
    { status: 400 },
  );
}

async function getTokenJsonBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const body = await response.clone().json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function getTokenResponseBody(response: Response) {
  const body = await getTokenJsonBody(response);
  return {
    accessToken:
      typeof body?.access_token === "string" ? body.access_token : undefined,
    refreshToken:
      typeof body?.refresh_token === "string" && body.refresh_token.length > 0
        ? body.refresh_token
        : undefined,
    scopes:
      typeof body?.scope === "string"
        ? [...new Set(body.scope.split(/\s+/).filter(Boolean))]
        : undefined,
  };
}

export async function validateOAuthRefreshTokenResources(
  request: Request,
  params: URLSearchParams,
) {
  const error = await validateRefreshTokenResources({
    grantType: params.get("grant_type"),
    hasResource: params.has("resource"),
    refreshToken: params.get("refresh_token"),
    resourceValues: params.getAll("resource"),
  });
  if (!error) return undefined;

  if (
    error.approvedResourceCount !== undefined &&
    error.requestedResourceCount !== undefined
  ) {
    logOAuthDebug("oauth.refresh-resources.rejected", request, {
      approvedResourceCount: error.approvedResourceCount,
      requestedResourceCount: error.requestedResourceCount,
    });
  }

  return invalidRefreshResourceResponse(error.errorDescription);
}

export async function persistOAuthRefreshTokenResources(
  request: Request,
  params: URLSearchParams,
  response: Response,
) {
  if (!response.ok) return;

  const body = await getTokenResponseBody(response);
  const issuedRefreshToken = body?.refreshToken;
  if (!issuedRefreshToken) return;

  const result = await persistRefreshTokenResources({
    accessToken: body.accessToken,
    grantType: params.get("grant_type"),
    issuedRefreshToken,
    refreshToken: params.get("refresh_token"),
    resourceValues: params.getAll("resource"),
  });

  if (result.persisted) {
    logOAuthDebug("oauth.refresh-resources.persisted", request, {
      resourceCount: result.resourceCount,
      updatedCount: result.updatedCount,
    });
    return;
  }

  if ("error" in result) {
    logOAuthDebug("oauth.refresh-resources.persist-failed", request, {
      error: result.error,
      resourceCount: result.resourceCount,
    });
  }
}

export async function replaceOAuthRefreshAccessToken(
  request: Request,
  params: URLSearchParams,
  response: Response,
) {
  if (
    !response.ok ||
    params.get("grant_type") !== OAUTH_REFRESH_TOKEN_GRANT_TYPE
  ) {
    return response;
  }

  const body = await getTokenJsonBody(response);
  if (!body || typeof body.access_token !== "string") return response;
  const effectiveScopes =
    typeof body.scope === "string"
      ? [...new Set(body.scope.split(/\s+/).filter(Boolean))]
      : undefined;
  if (!effectiveScopes) return response;

  const issued = await issueResourceBoundRefreshAccessToken({
    effectiveScopes,
    refreshToken: params.get("refresh_token"),
    resourceValues: params.getAll("resource"),
  });
  if (!issued) return response;

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "application/json; charset=utf-8");
  logOAuthDebug("oauth.refresh-access-token.replaced", request, {
    resourceCount: params.getAll("resource").length,
  });

  return jsonResponse(
    {
      ...body,
      access_token: issued.accessToken,
      expires_in: issued.expiresIn,
    },
    {
      headers,
      status: response.status,
      statusText: response.statusText,
    },
  );
}
