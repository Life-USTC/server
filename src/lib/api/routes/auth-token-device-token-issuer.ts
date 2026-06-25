import { randomBytesBase64Url } from "@/lib/crypto/web-crypto";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import {
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
} from "@/lib/oauth/constants";
import { DEVICE_CODE_STATUS } from "@/lib/oauth/device-code";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

export const DEVICE_ACCESS_TOKEN_EXPIRES_IN = 3600;
const DEVICE_REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 3600;

type JwtSigner = (input: {
  body: { payload: Record<string, unknown> };
}) => Promise<{ token?: unknown }>;

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
        refreshId?: string;
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

function resolveAccessTokenAudiences(resources: string[], scopes: string[]) {
  if (resources.length === 0) return [];
  const audiences = [...resources];
  if (scopes.includes(OAUTH_OPENID_SCOPE)) {
    audiences.push(`${getCanonicalOAuthIssuer()}/oauth2/userinfo`);
  }
  return [...new Set(audiences)];
}

async function signDeviceAccessToken(input: {
  clientId: string;
  expiresAt: number;
  issuedAt: number;
  resources: string[];
  scopes: string[];
  userId: string;
}) {
  const audiences = resolveAccessTokenAudiences(input.resources, input.scopes);
  if (audiences.length === 0) {
    return undefined;
  }

  const { betterAuthInstance } = await import("@/lib/auth/core");
  const signJWT = (betterAuthInstance.api as { signJWT?: JwtSigner }).signJWT;
  if (!signJWT) {
    throw new Error("Better Auth JWT signer is unavailable");
  }

  const result = await signJWT({
    body: {
      payload: {
        sub: input.userId,
        aud: audiences.length === 1 ? audiences[0] : audiences,
        azp: input.clientId,
        scope: input.scopes.join(" "),
        iss: getCanonicalOAuthIssuer(),
        iat: input.issuedAt,
        exp: input.expiresAt,
      },
    },
  });

  if (typeof result.token !== "string") {
    throw new Error("Better Auth JWT signer returned an invalid response");
  }

  return result.token;
}

export async function issueDeviceGrantTokens(
  prisma: DeviceGrantTokenPrisma,
  input: {
    clientId: string;
    deviceCodeRecordId: string;
    resources: string[];
    scopes: string[];
    userId: string;
  },
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + DEVICE_ACCESS_TOKEN_EXPIRES_IN;
  const accessExpiresAt = new Date(expiresAt * 1000);
  const refreshExpiresAt = new Date(
    Date.now() + DEVICE_REFRESH_TOKEN_EXPIRES_IN * 1000,
  );
  const jwtAccessToken = await signDeviceAccessToken({
    clientId: input.clientId,
    expiresAt,
    issuedAt,
    resources: input.resources,
    scopes: input.scopes,
    userId: input.userId,
  });
  const accessToken = jwtAccessToken ?? randomBytesBase64Url(32);
  const accessTokenHash = jwtAccessToken
    ? undefined
    : await hashOAuthClientSecretForDbStorage(accessToken);
  const shouldIssueRefreshToken = input.scopes.includes(
    OAUTH_OFFLINE_ACCESS_SCOPE,
  );
  const refreshToken = shouldIssueRefreshToken
    ? randomBytesBase64Url(32)
    : undefined;
  const refreshTokenHash = refreshToken
    ? await hashOAuthClientSecretForDbStorage(refreshToken)
    : undefined;

  const issued = await prisma.$transaction(async (tx) => {
    const claimed = await tx.deviceCode.deleteMany({
      where: {
        id: input.deviceCodeRecordId,
        status: DEVICE_CODE_STATUS.APPROVED,
      },
    });
    if (claimed.count !== 1) return false;

    const refreshRecord =
      refreshTokenHash &&
      (await tx.oAuthRefreshToken.create({
        data: {
          token: refreshTokenHash,
          clientId: input.clientId,
          userId: input.userId,
          scopes: input.scopes,
          expiresAt: refreshExpiresAt,
          authTime: new Date(issuedAt * 1000),
        },
      }));

    if (accessTokenHash) {
      await tx.oAuthAccessToken.create({
        data: {
          token: accessTokenHash,
          clientId: input.clientId,
          userId: input.userId,
          scopes: input.scopes,
          expiresAt: accessExpiresAt,
          ...(refreshRecord ? { refreshId: refreshRecord.id } : {}),
        },
      });
    }

    return true;
  });

  return issued
    ? {
        accessToken,
        expiresIn: DEVICE_ACCESS_TOKEN_EXPIRES_IN,
        ...(refreshToken ? { refreshToken } : {}),
      }
    : false;
}
