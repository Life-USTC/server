import { deviceAuthJsonError } from "@/lib/api/routes/auth-device-authorization-helpers";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import {
  DEVICE_CODE_EXPIRES_IN,
  generateDeviceCode,
  generateUserCode,
} from "@/lib/oauth/device-code";

export async function createDeviceAuthorizationGrant(
  request: Request,
  clientId: string,
  requestedScopes: string[],
) {
  const { prisma } = await import("@/lib/db/prisma");
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_EXPIRES_IN * 1000);

  try {
    await prisma.deviceCode.create({
      data: {
        deviceCode,
        userCode,
        clientId,
        scopes: requestedScopes,
        expiresAt,
      },
    });
  } catch (err) {
    logOAuthDebug("device-auth.error", request, {
      reason: "prisma_create_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      response: deviceAuthJsonError(
        500,
        "server_error",
        "Failed to create device code",
      ),
    };
  }

  return { deviceCode, userCode };
}
