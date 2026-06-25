import {
  DEVICE_CODE_ERRORS,
  DEVICE_CODE_POLL_INTERVAL,
  DEVICE_CODE_STATUS,
} from "@/lib/oauth/device-code";
import { getDeviceAuthorizationClientPolicyFailure } from "./auth-device-client-policy";
import { deviceCodeError } from "./auth-token-device-errors";

type DeviceGrantPrisma = {
  deviceCode: {
    findUnique: (input: {
      where: { deviceCode: string };
      select: {
        id: true;
        expiresAt: true;
        lastPolledAt: true;
        resources: true;
        status: true;
        userId: true;
        scopes: true;
        client: {
          select: {
            clientId: true;
            disabled: true;
            grantTypes: true;
            public: true;
            tokenEndpointAuthMethod: true;
            type: true;
          };
        };
      };
    }) => Promise<{
      client: {
        clientId: string;
        disabled: boolean;
        grantTypes: string[];
        public: boolean | null;
        tokenEndpointAuthMethod: string | null;
        type: string | null;
      };
      expiresAt: Date;
      id: string;
      lastPolledAt: Date | null;
      resources: string[];
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

type DeviceGrantRecord = NonNullable<
  Awaited<ReturnType<DeviceGrantPrisma["deviceCode"]["findUnique"]>>
>;

type DeviceGrantRecordResult =
  | { record: DeviceGrantRecord }
  | { response: Response };

export async function resolveDeviceGrantRecord({
  clientId,
  deviceCode,
  prisma,
}: {
  clientId: string;
  deviceCode: string;
  prisma: DeviceGrantPrisma;
}): Promise<DeviceGrantRecordResult> {
  const record = await prisma.deviceCode.findUnique({
    where: { deviceCode },
    select: {
      id: true,
      expiresAt: true,
      lastPolledAt: true,
      resources: true,
      status: true,
      userId: true,
      scopes: true,
      client: {
        select: {
          clientId: true,
          disabled: true,
          grantTypes: true,
          public: true,
          tokenEndpointAuthMethod: true,
          type: true,
        },
      },
    },
  });

  if (!record || record.client.clientId !== clientId) {
    return { response: deviceCodeError("invalid_grant") };
  }

  if (record.client.disabled) {
    return { response: deviceCodeError("invalid_client") };
  }

  if (getDeviceAuthorizationClientPolicyFailure(record.client)) {
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
