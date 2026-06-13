import { randomBytesBase64Url } from "@/lib/crypto/web-crypto";
import { DEVICE_CODE_STATUS } from "@/lib/oauth/device-code";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

export const DEVICE_ACCESS_TOKEN_EXPIRES_IN = 3600;
const DEVICE_REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 3600;

type DeviceGrantTokenTransaction = {
  deviceCode: {
    deleteMany: (input: {
      where: { id: string; status: string };
    }) => Promise<{ count: number }>;
  };
  oAuthAccessToken: {
    create: (input: {
      data: {
        clientId: string;
        expiresAt: Date;
        refreshId: string;
        scopes: string[];
        token: string;
        userId: string;
      };
    }) => Promise<unknown>;
  };
  oAuthRefreshToken: {
    create: (input: {
      data: {
        authTime: Date;
        clientId: string;
        expiresAt: Date;
        scopes: string[];
        token: string;
        userId: string;
      };
    }) => Promise<{ id: string }>;
  };
};

type DeviceGrantTokenPrisma = {
  $transaction: <Result>(
    callback: (tx: DeviceGrantTokenTransaction) => Promise<Result>,
  ) => Promise<Result>;
};

export async function issueDeviceGrantTokens(
  prisma: DeviceGrantTokenPrisma,
  input: {
    clientId: string;
    deviceCodeRecordId: string;
    scopes: string[];
    userId: string;
  },
) {
  const accessToken = randomBytesBase64Url(32);
  const refreshToken = randomBytesBase64Url(32);
  const [accessTokenHash, refreshTokenHash] = await Promise.all([
    hashOAuthClientSecretForDbStorage(accessToken),
    hashOAuthClientSecretForDbStorage(refreshToken),
  ]);

  const accessExpiresAt = new Date(
    Date.now() + DEVICE_ACCESS_TOKEN_EXPIRES_IN * 1000,
  );
  const refreshExpiresAt = new Date(
    Date.now() + DEVICE_REFRESH_TOKEN_EXPIRES_IN * 1000,
  );

  const issued = await prisma.$transaction(async (tx) => {
    const claimed = await tx.deviceCode.deleteMany({
      where: {
        id: input.deviceCodeRecordId,
        status: DEVICE_CODE_STATUS.APPROVED,
      },
    });
    if (claimed.count !== 1) return false;

    const refreshRecord = await tx.oAuthRefreshToken.create({
      data: {
        token: refreshTokenHash,
        clientId: input.clientId,
        userId: input.userId,
        scopes: input.scopes,
        expiresAt: refreshExpiresAt,
        authTime: new Date(),
      },
    });

    await tx.oAuthAccessToken.create({
      data: {
        token: accessTokenHash,
        clientId: input.clientId,
        userId: input.userId,
        scopes: input.scopes,
        expiresAt: accessExpiresAt,
        refreshId: refreshRecord.id,
      },
    });

    return true;
  });

  return issued ? { accessToken, refreshToken } : false;
}
