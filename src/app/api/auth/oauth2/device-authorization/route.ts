import { jsonResponse } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import {
  DEVICE_CODE_EXPIRES_IN,
  DEVICE_CODE_POLL_INTERVAL,
  generateDeviceCode,
  generateUserCode,
  getVerificationUri,
  getVerificationUriComplete,
} from "@/lib/oauth/device-code";
import { getPublicOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function jsonError(status: number, error: string, error_description: string) {
  return jsonResponse(
    { error, error_description },
    {
      status,
      headers: CORS_HEADERS,
    },
  );
}

function resolveRequestedScopes(
  scope: FormDataEntryValue | null,
  allowedScopes: string[],
) {
  if (scope instanceof File) {
    return {
      error: jsonError(400, "invalid_request", "scope must be a string"),
    };
  }

  const requestedScopes =
    typeof scope === "string" && scope.trim().length > 0
      ? scope.trim().split(/\s+/)
      : allowedScopes;

  const allowed = new Set(allowedScopes);
  const invalidScopes = requestedScopes.filter((value) => !allowed.has(value));
  if (invalidScopes.length > 0) {
    return {
      error: jsonError(
        400,
        "invalid_scope",
        "Requested scope is not allowed for this client",
      ),
    };
  }

  return { scopes: [...new Set(requestedScopes)] };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  logOAuthDebug("device-auth.request", request, {
    path: new URL(request.url).pathname,
  });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_form_body",
    });
    return jsonError(
      400,
      "invalid_request",
      "Request body must be application/x-www-form-urlencoded",
    );
  }

  const clientId = formData.get("client_id");
  const scope = formData.get("scope");

  if (!clientId || typeof clientId !== "string") {
    logOAuthDebug("device-auth.reject", request, {
      reason: "missing_client_id",
    });
    return jsonError(400, "invalid_request", "client_id is required");
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { clientId: true, disabled: true, scopes: true, name: true },
  });

  if (!client || client.disabled) {
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_client",
      clientIdPrefix: clientId.slice(0, 8),
    });
    return jsonError(400, "invalid_client", "Unknown or disabled client");
  }

  const requestedScopesResult = resolveRequestedScopes(scope, client.scopes);
  if ("error" in requestedScopesResult) {
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_scope",
      clientIdPrefix: clientId.slice(0, 8),
    });
    return requestedScopesResult.error;
  }
  const requestedScopes = requestedScopesResult.scopes;

  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_EXPIRES_IN * 1000);

  try {
    await prisma.deviceCode.create({
      data: {
        deviceCode,
        userCode,
        clientId: client.clientId,
        scopes: requestedScopes,
        expiresAt,
      },
    });
  } catch (err) {
    logOAuthDebug("device-auth.error", request, {
      reason: "prisma_create_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "server_error", "Failed to create device code");
  }

  const siteOrigin = getPublicOrigin();

  logOAuthDebug("device-auth.success", request, {
    clientIdPrefix: clientId.slice(0, 8),
    userCodePrefix: userCode.slice(0, 4),
    scopeCount: requestedScopes.length,
  });

  return jsonResponse(
    {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: getVerificationUri(siteOrigin),
      verification_uri_complete: getVerificationUriComplete(
        siteOrigin,
        userCode,
      ),
      expires_in: DEVICE_CODE_EXPIRES_IN,
      interval: DEVICE_CODE_POLL_INTERVAL,
    },
    { headers: CORS_HEADERS },
  );
}
