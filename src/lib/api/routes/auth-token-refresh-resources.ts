import {
  persistRefreshTokenResources,
  validateRefreshTokenResources,
} from "@/features/oauth/server/refresh-token-resources.server";
import { jsonResponse } from "@/lib/api/helpers";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

function invalidRefreshResourceResponse(error_description: string) {
  return jsonResponse(
    {
      error: "invalid_target",
      error_description,
    },
    { status: 400 },
  );
}

async function getTokenResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const body = (await response.clone().json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
    };
    return {
      accessToken:
        typeof body.access_token === "string" ? body.access_token : undefined,
      refreshToken:
        typeof body.refresh_token === "string" && body.refresh_token.length > 0
          ? body.refresh_token
          : undefined,
    };
  } catch {
    return null;
  }
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
