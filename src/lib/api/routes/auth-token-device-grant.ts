import { resolveRequestedDeviceResources } from "@/lib/api/routes/auth-device-authorization-helpers";
import { issueDeviceGrantTokens } from "@/lib/api/routes/auth-token-device-token-issuer";
import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { deviceCodeError } from "./auth-token-device-errors";
import { resolveDeviceGrantRecord } from "./auth-token-device-record";
import { deviceGrantTokenResponse } from "./auth-token-device-response";

type TokenRequestResourcesResult =
  | { resources: string[] }
  | { response: Response };

function parseTokenRequestResources(
  params: URLSearchParams,
): TokenRequestResourcesResult {
  const result = resolveRequestedDeviceResources(params.getAll("resource"), []);
  if ("error" in result) {
    return { response: result.error };
  }
  return { resources: result.resources };
}

function resourceSetsMatch(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((resource) => rightSet.has(resource));
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
  if ("response" in recordResult) {
    return recordResult.response;
  }
  const { record } = recordResult;
  const userId = record.userId;
  if (!userId) {
    return deviceCodeError("authorization_pending");
  }
  if (
    requestedResources.resources.length > 0 &&
    !resourceSetsMatch(requestedResources.resources, record.resources)
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
