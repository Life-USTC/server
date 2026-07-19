import { randomBytesBase64Url } from "@/lib/crypto/web-crypto";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import {
  OAUTH_GRANT_ID_CLAIM,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
} from "@/lib/oauth/constants";
import { DEVICE_CODE_STATUS } from "@/lib/oauth/device-code";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

export const RESOURCE_BOUND_ACCESS_TOKEN_EXPIRES_IN = 3600;
export const DEVICE_ACCESS_TOKEN_EXPIRES_IN =
  RESOURCE_BOUND_ACCESS_TOKEN_EXPIRES_IN;
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
    deleteMany: (input: {
      where: { clientId: string; userId: string };
    }) => Promise<{ count: number }>;
    create: (input: {
      data: {
        clientId: string;
        expiresAt: Date;
        grantId: string;
        referenceId: string;
        refreshId?: string;
        scopes: string[];
        token: string;
        userId: string;
      };
    }) => Promise<unknown>;
  };
  oAuthClient: {
    findUnique: (input: {
      where: { clientId: string };
      select: { disabled: true; skipConsent: true };
    }) => Promise<{ disabled: boolean; skipConsent: boolean | null } | null>;
  };
  oAuthConsent: {
    deleteMany: (input: {
      where: { clientId: string; userId: string };
    }) => Promise<{ count: number }>;
    upsert: (input: {
      where: {
        clientId_userId: { clientId: string; userId: string };
      };
      create: {
        clientId: string;
        grantId: string;
        scopes: string[];
        userId: string;
      };
      update: {
        grantId: string;
        scopes: string[];
      };
    }) => Promise<unknown>;
  };
  oAuthRefreshToken: {
    deleteMany: (input: {
      where: { clientId: string; userId: string };
    }) => Promise<{ count: number }>;
    create: (input: {
      data: {
        authTime: Date;
        clientId: string;
        expiresAt: Date;
        grantId: string;
        referenceId: string;
        resources: string[];
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

export async function signResourceBoundOAuthAccessToken(input: {
  clientId: string;
  expiresAt: number;
  grantId?: string;
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
        ...(input.grantId ? { [OAUTH_GRANT_ID_CLAIM]: input.grantId } : {}),
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
  const grantId = crypto.randomUUID();
  const jwtAccessToken = await signResourceBoundOAuthAccessToken({
    clientId: input.clientId,
    expiresAt,
    grantId,
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

    const identity = {
      clientId: input.clientId,
      userId: input.userId,
    };
    const client = await tx.oAuthClient.findUnique({
      where: { clientId: input.clientId },
      select: { disabled: true, skipConsent: true },
    });
    if (!client || client.disabled) return false;
    if (client.skipConsent === true) {
      await tx.oAuthConsent.deleteMany({ where: identity });
    } else {
      await tx.oAuthConsent.upsert({
        where: {
          clientId_userId: identity,
        },
        create: {
          clientId: input.clientId,
          grantId,
          scopes: input.scopes,
          userId: input.userId,
        },
        update: {
          grantId,
          scopes: input.scopes,
        },
      });
    }
    await tx.oAuthAccessToken.deleteMany({ where: identity });
    await tx.oAuthRefreshToken.deleteMany({ where: identity });

    const refreshRecord =
      refreshTokenHash &&
      (await tx.oAuthRefreshToken.create({
        data: {
          token: refreshTokenHash,
          clientId: input.clientId,
          grantId,
          userId: input.userId,
          referenceId: grantId,
          resources: input.resources,
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
          grantId,
          userId: input.userId,
          referenceId: grantId,
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
