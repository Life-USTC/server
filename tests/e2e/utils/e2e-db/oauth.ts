import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
  type SupportedOAuthClientAuthMethod,
} from "@/lib/oauth/constants";
import { generateToken, PLAYWRIGHT_BASE_URL } from "./core";

export async function createOAuthClientFixture(
  options: {
    name?: string;
    redirectUris?: string[];
    scopes?: string[];
    grantTypes?: string[];
    clientId?: string;
    clientSecret?: string;
    tokenEndpointAuthMethod?: SupportedOAuthClientAuthMethod;
  } = {},
) {
  const clientId = options.clientId ?? generateToken(16);
  const tokenEndpointAuthMethod =
    options.tokenEndpointAuthMethod ?? OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD;
  const clientSecret =
    tokenEndpointAuthMethod === OAUTH_PUBLIC_CLIENT_AUTH_METHOD
      ? null
      : (options.clientSecret ?? generateToken(24));
  const publicClientStoredSecret = generateToken(24);
  const redirectUris = options.redirectUris ?? [
    `${PLAYWRIGHT_BASE_URL}/oauth-e2e/callback`,
  ];
  const grantTypes =
    options.grantTypes ??
    (tokenEndpointAuthMethod === OAUTH_PUBLIC_CLIENT_AUTH_METHOD
      ? [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE]
      : [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE, OAUTH_REFRESH_TOKEN_GRANT_TYPE]);
  const scopes = options.scopes ?? [...DEFAULT_OAUTH_CLIENT_SCOPES];
  const name = options.name ?? `e2e-oauth-${Date.now()}`;

  const client = await prisma.oAuthClient.create({
    data: {
      name,
      clientId,
      clientSecret:
        tokenEndpointAuthMethod === OAUTH_PUBLIC_CLIENT_AUTH_METHOD
          ? publicClientStoredSecret
          : clientSecret,
      redirectUris,
      type:
        tokenEndpointAuthMethod === OAUTH_PUBLIC_CLIENT_AUTH_METHOD
          ? "public"
          : "web",
      tokenEndpointAuthMethod,
      disabled: false,
      scopes,
      grantTypes,
      responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
      requirePKCE: true,
      metadata: { source: "e2e_fixture" },
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      tokenEndpointAuthMethod: true,
      redirectUris: true,
      scopes: true,
    },
  });

  return {
    ...client,
    tokenEndpointAuthMethod:
      client.tokenEndpointAuthMethod ?? OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
    clientSecret,
  };
}

export async function deleteOAuthClientsByName(name: string) {
  await prisma.oAuthClient.deleteMany({
    where: { name },
  });
}

export async function ensureLinkedAccountFixture(options: {
  userId: string;
  provider: "github" | "google" | "oidc";
  providerAccountId?: string;
  email?: string;
}) {
  const providerAccountId =
    options.providerAccountId ??
    `${options.provider}-e2e-${Date.now()}-${generateToken(6)}`;
  const email =
    options.email ??
    `${options.provider}-${Date.now()}-${generateToken(6)}@example.test`;

  await prisma.account.create({
    data: {
      userId: options.userId,
      type: "oauth",
      provider: options.provider,
      providerAccountId,
    },
  });

  await prisma.verifiedEmail.create({
    data: {
      userId: options.userId,
      provider: options.provider,
      email,
    },
  });

  return {
    provider: options.provider,
    providerAccountId,
    email,
  };
}

export async function deleteLinkedAccountFixture(options: {
  userId: string;
  provider: string;
}) {
  await prisma.account.deleteMany({
    where: {
      userId: options.userId,
      provider: options.provider,
    },
  });

  await prisma.verifiedEmail.deleteMany({
    where: {
      userId: options.userId,
      provider: options.provider,
    },
  });
}
