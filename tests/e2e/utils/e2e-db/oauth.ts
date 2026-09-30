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
import { withE2ePrisma } from "./prisma";

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

  const client = await withE2ePrisma((prisma) =>
    prisma.oAuthClient.create({
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
    }),
  );

  return {
    ...client,
    tokenEndpointAuthMethod:
      client.tokenEndpointAuthMethod ?? OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
    clientSecret,
  };
}

export async function deleteOAuthClientsByName(name: string) {
  await withE2ePrisma((prisma) =>
    prisma.oAuthClient.deleteMany({
      where: { name },
    }),
  );
}
