import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { getOAuthProviderValidAudiences } from "@/lib/mcp/urls";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import {
  hashOAuthClientSecretForDbStorage,
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

function normalizeRequestedResources(params: URLSearchParams) {
  const validAudiences = getOAuthProviderValidAudiences();
  const resources: string[] = [];

  for (const entry of params.getAll("resource")) {
    const value = entry.trim();
    if (!value) continue;

    let normalized: string;
    try {
      normalized = normalizeResourceIndicator(value);
    } catch {
      continue;
    }

    const matchedAudience = validAudiences.find((audience) =>
      resourceIndicatorsMatch(normalized, audience),
    );
    if (
      matchedAudience &&
      !resources.some((resource) =>
        resourceIndicatorsMatch(resource, matchedAudience),
      )
    ) {
      resources.push(matchedAudience);
    }
  }

  return resources;
}

async function getExistingRefreshResources(params: URLSearchParams) {
  const refreshToken = params.get("refresh_token");
  if (!refreshToken) return [];

  const tokenHash = await hashOAuthClientSecretForDbStorage(refreshToken);
  const refreshRecord = await prisma.oAuthRefreshToken.findUnique({
    where: { token: tokenHash },
    select: { resources: true },
  });
  return refreshRecord?.resources ?? [];
}

async function resolveApprovedRefreshResources(params: URLSearchParams) {
  const grantType = params.get("grant_type");
  if (grantType === OAUTH_REFRESH_TOKEN_GRANT_TYPE) {
    return getExistingRefreshResources(params);
  }
  return [];
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function getAudienceValues(payload: Record<string, unknown> | null) {
  const aud = payload?.aud;
  if (typeof aud === "string") return [aud];
  if (Array.isArray(aud)) {
    return aud.filter((value) => typeof value === "string");
  }
  return [];
}

function indicatorsMatch(left: string, right: string) {
  try {
    return resourceIndicatorsMatch(left, right);
  } catch {
    return false;
  }
}

function getIssuedAccessTokenResources(
  accessToken: string | undefined,
  requestedResources: string[],
) {
  if (!accessToken || requestedResources.length === 0) return [];

  const audiences = getAudienceValues(decodeJwtPayload(accessToken));
  return requestedResources.filter((resource) =>
    audiences.some((audience) => indicatorsMatch(audience, resource)),
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

async function resolveIssuedRefreshResources(
  params: URLSearchParams,
  body: { accessToken?: string },
) {
  if (params.get("grant_type") === OAUTH_AUTHORIZATION_CODE_GRANT_TYPE) {
    return getIssuedAccessTokenResources(
      body.accessToken,
      normalizeRequestedResources(params),
    );
  }

  return resolveApprovedRefreshResources(params);
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

  const resources = await resolveIssuedRefreshResources(params, body);
  if (resources.length === 0) return;

  try {
    const tokenHash =
      await hashOAuthClientSecretForDbStorage(issuedRefreshToken);
    const result = await prisma.oAuthRefreshToken.updateMany({
      where: { token: tokenHash },
      data: { resources },
    });
    logOAuthDebug("oauth.refresh-resources.persisted", request, {
      resourceCount: resources.length,
      updatedCount: result.count,
    });
  } catch (err) {
    logOAuthDebug("oauth.refresh-resources.persist-failed", request, {
      error: err instanceof Error ? err.message : String(err),
      resourceCount: resources.length,
    });
  }
}
