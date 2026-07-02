import { prisma as defaultPrisma } from "@/lib/db/prisma";
import {
  DEVICE_CODE_ERRORS,
  DEVICE_CODE_EXPIRES_IN,
  DEVICE_CODE_POLL_INTERVAL,
  DEVICE_CODE_STATUS,
  generateDeviceCode,
  generateUserCode,
} from "@/lib/oauth/device-code";
import { getDeviceAuthorizationClientPolicyFailure } from "./device-authorization-policy.server";

type DeviceGrantPrisma = {
  $queryRaw?: <T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
  deviceCode: {
    create: (input: {
      data: {
        clientId: string;
        deviceCode: string;
        expiresAt: Date;
        resources: string[];
        scopes: string[];
        userCode: string;
      };
    }) => Promise<unknown>;
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
  | { error: { code: string; status?: number } };

type DeviceGrantRecordRow = {
  clientClientId: string;
  clientDisabled: boolean;
  clientGrantTypes: string[];
  clientPublic: boolean | null;
  clientTokenEndpointAuthMethod: string | null;
  clientType: string | null;
  expiresAt: Date;
  id: string;
  lastPolledAt: Date | null;
  resources: string[];
  scopes: string[];
  status: string;
  userId: string | null;
};

export async function createDeviceAuthorizationGrant({
  clientId,
  prisma = defaultPrisma,
  requestedResources,
  requestedScopes,
}: {
  clientId: string;
  prisma?: Pick<DeviceGrantPrisma, "deviceCode">;
  requestedResources: string[];
  requestedScopes: string[];
}) {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_EXPIRES_IN * 1000);

  await prisma.deviceCode.create({
    data: {
      deviceCode,
      userCode,
      clientId,
      scopes: requestedScopes,
      resources: requestedResources,
      expiresAt,
    },
  });

  return { deviceCode, userCode };
}

export function deviceGrantResourceSetsMatch(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((resource) => rightSet.has(resource));
}

export async function resolveDeviceGrantRecord({
  clientId,
  deviceCode,
  prisma = defaultPrisma,
}: {
  clientId: string;
  deviceCode: string;
  prisma?: DeviceGrantPrisma;
}): Promise<DeviceGrantRecordResult> {
  const record =
    typeof prisma.$queryRaw === "function"
      ? await resolveFreshDeviceGrantRecord(prisma, deviceCode)
      : await prisma.deviceCode.findUnique({
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
    return { error: { code: "invalid_grant" } };
  }

  if (record.client.disabled) {
    return { error: { code: "invalid_client" } };
  }

  if (getDeviceAuthorizationClientPolicyFailure(record.client)) {
    return { error: { code: "invalid_client" } };
  }

  if (record.expiresAt < new Date()) {
    return { error: { code: DEVICE_CODE_ERRORS.EXPIRED_TOKEN } };
  }

  if (record.lastPolledAt) {
    const elapsed = Date.now() - record.lastPolledAt.getTime();
    if (elapsed < DEVICE_CODE_POLL_INTERVAL * 1000) {
      await prisma.deviceCode.update({
        where: { id: record.id },
        data: { lastPolledAt: new Date() },
      });
      return { error: { code: DEVICE_CODE_ERRORS.SLOW_DOWN } };
    }
  }

  await prisma.deviceCode.update({
    where: { id: record.id },
    data: { lastPolledAt: new Date() },
  });

  if (record.status === DEVICE_CODE_STATUS.DENIED) {
    return { error: { code: DEVICE_CODE_ERRORS.ACCESS_DENIED } };
  }

  if (record.status === DEVICE_CODE_STATUS.PENDING) {
    return {
      error: { code: DEVICE_CODE_ERRORS.AUTHORIZATION_PENDING },
    };
  }

  if (!record.userId) {
    return { error: { code: "server_error", status: 500 } };
  }

  return { record };
}

async function resolveFreshDeviceGrantRecord(
  prisma: DeviceGrantPrisma & Required<Pick<DeviceGrantPrisma, "$queryRaw">>,
  deviceCode: string,
): Promise<DeviceGrantRecord | null> {
  const rows = await prisma.$queryRaw<DeviceGrantRecordRow[]>`
    SELECT
      dc."id",
      dc."expiresAt",
      dc."lastPolledAt",
      dc."resources",
      dc."status",
      dc."userId",
      dc."scopes",
      c."clientId" AS "clientClientId",
      c."disabled" AS "clientDisabled",
      c."grantTypes" AS "clientGrantTypes",
      c."public" AS "clientPublic",
      c."tokenEndpointAuthMethod" AS "clientTokenEndpointAuthMethod",
      c."type" AS "clientType"
    FROM "DeviceCode" dc
    JOIN "OAuthClient" c ON c."clientId" = dc."clientId"
    WHERE dc."deviceCode" = ${deviceCode}
      AND NOW() IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? {
        id: row.id,
        expiresAt: row.expiresAt,
        lastPolledAt: row.lastPolledAt,
        resources: row.resources,
        status: row.status,
        userId: row.userId,
        scopes: row.scopes,
        client: {
          clientId: row.clientClientId,
          disabled: row.clientDisabled,
          grantTypes: row.clientGrantTypes,
          public: row.clientPublic,
          tokenEndpointAuthMethod: row.clientTokenEndpointAuthMethod,
          type: row.clientType,
        },
      }
    : null;
}
