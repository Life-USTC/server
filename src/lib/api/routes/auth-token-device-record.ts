import {
  DEVICE_CODE_ERRORS,
  DEVICE_CODE_POLL_INTERVAL,
  DEVICE_CODE_STATUS,
} from "@/lib/oauth/device-code";
import { deviceCodeError } from "./auth-token-device-errors";

type DeviceGrantPrisma = {
  deviceCode: {
    findUnique: (input: {
      where: { deviceCode: string };
      select: {
        id: true;
        expiresAt: true;
        lastPolledAt: true;
        status: true;
        userId: true;
        scopes: true;
        client: { select: { clientId: true; disabled: true } };
      };
    }) => Promise<{
      client: { clientId: string; disabled: boolean };
      expiresAt: Date;
      id: string;
      lastPolledAt: Date | null;
      scopes: string[];
      status: string;
      userId: string | null;
    } | null>;
    update: (input: {
      where: { id: string };
      data: { lastPolledAt: Date };
    }) => Promise<unknown>;
  };
};

export async function resolveDeviceGrantRecord({
  clientId,
  deviceCode,
  prisma,
}: {
  clientId: string;
  deviceCode: string;
  prisma: DeviceGrantPrisma;
}) {
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
    return { response: deviceCodeError("invalid_grant") };
  }

  if (record.client.disabled) {
    return { response: deviceCodeError("invalid_client") };
  }

  if (record.expiresAt < new Date()) {
    return { response: deviceCodeError(DEVICE_CODE_ERRORS.EXPIRED_TOKEN) };
  }

  if (record.lastPolledAt) {
    const elapsed = Date.now() - record.lastPolledAt.getTime();
    if (elapsed < DEVICE_CODE_POLL_INTERVAL * 1000) {
      await prisma.deviceCode.update({
        where: { id: record.id },
        data: { lastPolledAt: new Date() },
      });
      return { response: deviceCodeError(DEVICE_CODE_ERRORS.SLOW_DOWN) };
    }
  }

  await prisma.deviceCode.update({
    where: { id: record.id },
    data: { lastPolledAt: new Date() },
  });

  if (record.status === DEVICE_CODE_STATUS.DENIED) {
    return { response: deviceCodeError(DEVICE_CODE_ERRORS.ACCESS_DENIED) };
  }

  if (record.status === DEVICE_CODE_STATUS.PENDING) {
    return {
      response: deviceCodeError(DEVICE_CODE_ERRORS.AUTHORIZATION_PENDING),
    };
  }

  if (!record.userId) {
    return { response: deviceCodeError("server_error", 500) };
  }

  return { record };
}
