import { randomBytes } from "node:crypto";
import { handlers } from "@/auth";
import { jsonResponse } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";
import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
  withBetterAuthOAuthDebug,
} from "@/lib/log/oauth-debug";
import { getOAuthMcpResourceUrl } from "@/lib/mcp/urls";
import { recordOAuthTokenRequestMetric } from "@/lib/metrics/observability-metrics";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import {
  DEVICE_CODE_ERRORS,
  DEVICE_CODE_POLL_INTERVAL,
  DEVICE_CODE_STATUS,
} from "@/lib/oauth/device-code";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

export const dynamic = "force-dynamic";

const DEVICE_ACCESS_TOKEN_EXPIRES_IN = 3600;
const DEVICE_REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 3600;

function deviceCodeError(error: string, status = 400) {
  return jsonResponse({ error }, { status });
}

function logObservedTokenRedirectRequest(
  request: Request,
  params: URLSearchParams,
): void {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return;
  }

  logOAuthDebug("oauth.token.request-observed", request, {
    path: new URL(request.url).pathname,
    clientIdPrefix: clientId.slice(0, 16),
    grantType: params.get("grant_type"),
    ...summarizeOAuthRedirectUri(redirectUri),
    ...summarizeOAuthForwardingHeaders(request),
  });
}

async function maybeNormalizeTokenLoopbackRedirectRequest(
  request: Request,
  params: URLSearchParams,
): Promise<Request> {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return request;
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { redirectUris: true },
  });
  if (!client) {
    return request;
  }

  const normalizedRedirectUri = resolveEquivalentLoopbackRedirectUri(
    client.redirectUris,
    redirectUri,
  );
  if (!normalizedRedirectUri || normalizedRedirectUri === redirectUri) {
    return request;
  }

  params.set("redirect_uri", normalizedRedirectUri);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  logOAuthDebug("oauth.loopback-redirect-normalized", request, {
    path: new URL(request.url).pathname,
    clientIdPrefix: clientId.slice(0, 16),
    fromRedirect: summarizeOAuthRedirectUri(redirectUri),
    toRedirect: summarizeOAuthRedirectUri(normalizedRedirectUri),
  });
  return new Request(request.url, {
    method: request.method,
    headers,
    body: params.toString(),
  });
}

async function maybeBindMcpRefreshRequest(
  request: Request,
  params: URLSearchParams,
): Promise<Request> {
  if (
    params.get("grant_type") !== OAUTH_REFRESH_TOKEN_GRANT_TYPE ||
    params.has("resource")
  ) {
    return request;
  }

  const refreshToken = params.get("refresh_token");
  if (!refreshToken) {
    return request;
  }

  const refreshTokenHash = hashOAuthClientSecretForDbStorage(refreshToken);
  const refreshRecord = await prisma.oAuthRefreshToken.findUnique({
    where: { token: refreshTokenHash },
    select: { scopes: true },
  });
  if (!refreshRecord?.scopes.includes(MCP_TOOLS_SCOPE)) {
    return request;
  }

  params.set("resource", getOAuthMcpResourceUrl());
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  logOAuthDebug("oauth.mcp-refresh-resource-bound", request, {
    path: new URL(request.url).pathname,
    scopeCount: refreshRecord.scopes.length,
  });
  return new Request(request.url, {
    method: request.method,
    headers,
    body: params.toString(),
  });
}

async function handleDeviceCodeGrant(
  request: Request,
  params: URLSearchParams,
) {
  const deviceCode = params.get("device_code");
  const clientId = params.get("client_id");

  if (!deviceCode || !clientId) {
    return deviceCodeError("invalid_request");
  }

  const record = await prisma.deviceCode.findUnique({
    where: { deviceCode },
    select: {
      id: true,
      expiresAt: true,
      lastPolledAt: true,
      status: true,
      userId: true,
      scopes: true,
      client: { select: { clientId: true, disabled: true } },
    },
  });

  if (!record || record.client.clientId !== clientId) {
    return deviceCodeError("invalid_grant");
  }

  if (record.client.disabled) {
    return deviceCodeError("invalid_client");
  }

  if (record.expiresAt < new Date()) {
    return deviceCodeError(DEVICE_CODE_ERRORS.EXPIRED_TOKEN);
  }

  if (record.lastPolledAt) {
    const elapsed = Date.now() - record.lastPolledAt.getTime();
    if (elapsed < DEVICE_CODE_POLL_INTERVAL * 1000) {
      await prisma.deviceCode.update({
        where: { id: record.id },
        data: { lastPolledAt: new Date() },
      });
      return deviceCodeError(DEVICE_CODE_ERRORS.SLOW_DOWN);
    }
  }

  await prisma.deviceCode.update({
    where: { id: record.id },
    data: { lastPolledAt: new Date() },
  });

  if (record.status === DEVICE_CODE_STATUS.DENIED) {
    return deviceCodeError(DEVICE_CODE_ERRORS.ACCESS_DENIED);
  }

  if (record.status === DEVICE_CODE_STATUS.PENDING) {
    return deviceCodeError(DEVICE_CODE_ERRORS.AUTHORIZATION_PENDING);
  }

  if (!record.userId) {
    return deviceCodeError("server_error", 500);
  }
  const userId = record.userId;

  const accessTokenPlain = randomBytes(32).toString("base64url");
  const refreshTokenPlain = randomBytes(32).toString("base64url");
  const accessTokenHash = hashOAuthClientSecretForDbStorage(accessTokenPlain);
  const refreshTokenHash = hashOAuthClientSecretForDbStorage(refreshTokenPlain);

  const accessExpiresAt = new Date(
    Date.now() + DEVICE_ACCESS_TOKEN_EXPIRES_IN * 1000,
  );
  const refreshExpiresAt = new Date(
    Date.now() + DEVICE_REFRESH_TOKEN_EXPIRES_IN * 1000,
  );

  const issued = await prisma.$transaction(async (tx) => {
    const claimed = await tx.deviceCode.deleteMany({
      where: {
        id: record.id,
        status: DEVICE_CODE_STATUS.APPROVED,
      },
    });
    if (claimed.count !== 1) return false;

    const refreshRecord = await tx.oAuthRefreshToken.create({
      data: {
        token: refreshTokenHash,
        clientId: record.client.clientId,
        userId,
        scopes: record.scopes,
        expiresAt: refreshExpiresAt,
        authTime: new Date(),
      },
    });

    await tx.oAuthAccessToken.create({
      data: {
        token: accessTokenHash,
        clientId: record.client.clientId,
        userId,
        scopes: record.scopes,
        expiresAt: accessExpiresAt,
        refreshId: refreshRecord.id,
      },
    });

    return true;
  });

  if (!issued) {
    return deviceCodeError("invalid_grant");
  }

  logOAuthDebug("device-token.success", request, {
    clientIdPrefix: clientId.slice(0, 8),
    userId,
    scopeCount: record.scopes.length,
  });

  return jsonResponse({
    access_token: accessTokenPlain,
    token_type: "Bearer",
    expires_in: DEVICE_ACCESS_TOKEN_EXPIRES_IN,
    refresh_token: refreshTokenPlain,
    scope: record.scopes.join(" "),
  });
}

async function withTokenMetrics(
  params: URLSearchParams,
  run: () => Promise<Response>,
) {
  const start = Date.now();
  try {
    const response = await run();
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

export async function POST(request: Request) {
  const cloned = request.clone();

  let params: URLSearchParams;
  try {
    const body = await cloned.text();
    params = new URLSearchParams(body);
  } catch {
    // If body parsing fails, delegate to Better Auth
    return withBetterAuthOAuthDebug("POST", request, handlers.POST);
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
      handlers.POST,
    ),
  );
}

export function GET(request: Request) {
  return withBetterAuthOAuthDebug("GET", request, handlers.GET);
}
