import { resolveRequestedDeviceResources } from "@/features/oauth/server/device-authorization-policy.server";
import {
  deviceGrantResourceSetsMatch,
  resolveDeviceGrantRecord,
} from "@/features/oauth/server/device-grant-policy.server";
import { issueDeviceGrantTokens } from "@/features/oauth/server/device-token-issuer.server";
import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { deviceAuthJsonError } from "./auth-device-authorization-helpers";
import { deviceCodeError } from "./auth-token-device-errors";
import { deviceGrantTokenResponse } from "./auth-token-device-response";

type TokenRequestResourcesResult =
  | { resources: string[] }
  | { response: Response };

function parseTokenRequestResources(
  params: URLSearchParams,
): TokenRequestResourcesResult {
  const result = resolveRequestedDeviceResources(params.getAll("resource"), []);
  if ("error" in result) {
    return {
      response: deviceAuthJsonError(
        result.error.status,
        result.error.error,
        result.error.errorDescription,
      ),
    };
  }
  return { resources: result.resources };
}

export async function handleDeviceCodeGrant(
  request: Request,
  params: URLSearchParams,
): Promise<Response> {
  const deviceCode = params.get("device_code");
  const clientId = params.get("client_id");

  if (!deviceCode || !clientId) {
    return deviceCodeError("invalid_request");
  }

  const requestedResources = parseTokenRequestResources(params);
  if ("response" in requestedResources) {
    return requestedResources.response;
  }

  const recordResult = await resolveDeviceGrantRecord({
    clientId,
    deviceCode,
    prisma,
  });
  if ("error" in recordResult) {
    return deviceCodeError(
      recordResult.error.code,
      recordResult.error.status ?? 400,
    );
  }
  const { record } = recordResult;
  const userId = record.userId;
  if (!userId) {
    return deviceCodeError("authorization_pending");
  }
  if (
    requestedResources.resources.length > 0 &&
    !deviceGrantResourceSetsMatch(
      requestedResources.resources,
      record.resources,
    )
  ) {
    return deviceCodeError("invalid_target");
  }
  const issued = await issueDeviceGrantTokens(prisma, {
    clientId: record.client.clientId,
    deviceCodeRecordId: record.id,
    resources: record.resources,
    scopes: record.scopes,
    userId,
  });

  if (!issued) {
    return deviceCodeError("invalid_grant");
  }

  logOAuthDebug("device-token.success", request, {
    clientIdPrefix: clientId.slice(0, 8),
    resourceCount: record.resources.length,
    userId,
    scopeCount: record.scopes.length,
  });

  return deviceGrantTokenResponse({ issued, scopes: record.scopes });
}
