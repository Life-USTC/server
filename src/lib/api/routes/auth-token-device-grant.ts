import { issueDeviceGrantTokens } from "@/lib/api/routes/auth-token-device-token-issuer";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { deviceCodeError } from "./auth-token-device-errors";
import { resolveDeviceGrantRecord } from "./auth-token-device-record";
import { deviceGrantTokenResponse } from "./auth-token-device-response";

export async function handleDeviceCodeGrant(
  request: Request,
  params: URLSearchParams,
) {
  const deviceCode = params.get("device_code");
  const clientId = params.get("client_id");

  if (!deviceCode || !clientId) {
    return deviceCodeError("invalid_request");
  }

  const { prisma } = await import("@/lib/db/prisma");
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
  const issued = await issueDeviceGrantTokens(prisma, {
    clientId: record.client.clientId,
    deviceCodeRecordId: record.id,
    scopes: record.scopes,
    userId,
  });

  if (!issued) {
    return deviceCodeError("invalid_grant");
  }

  logOAuthDebug("device-token.success", request, {
    clientIdPrefix: clientId.slice(0, 8),
    userId,
    scopeCount: record.scopes.length,
  });

  return deviceGrantTokenResponse({ issued, scopes: record.scopes });
}
