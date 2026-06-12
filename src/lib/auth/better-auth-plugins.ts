import { genericOAuth, jwt, oAuthProxy } from "better-auth/plugins";
import type { getAuthEnv } from "@/app-env";
import { buildOAuthProviderPlugin } from "@/lib/auth/better-auth-oauth-provider-plugin";
import { mapOidcProfileToUser } from "@/lib/auth/oauth-profile";
import { webhookLoginPlugin } from "@/lib/auth/webhook-login-plugin";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import { OAUTH_OPENID_SCOPE } from "@/lib/oauth/constants";
import { getCanonicalOrigin } from "@/lib/site-url";

type AuthEnv = ReturnType<typeof getAuthEnv>;

export function buildBetterAuthPlugins(input: {
  authEnv: AuthEnv;
  authPublicOrigin: string;
  oauthProxySecret: string | undefined;
  oidcDiscoveryUrl: string;
  oidcIssuer: string;
}) {
  return [
    jwt({
      jwt: {
        issuer: getCanonicalOAuthIssuer(),
      },
      schema: {
        jwks: {
          modelName: "Jwks",
        },
      },
    }),
    oAuthProxy({
      productionURL: getCanonicalOrigin(),
      currentURL: input.authPublicOrigin,
      ...(input.oauthProxySecret ? { secret: input.oauthProxySecret } : {}),
    }),
    webhookLoginPlugin(),
    buildOAuthProviderPlugin({
      authPublicOrigin: input.authPublicOrigin,
    }),
    genericOAuth({
      config: [
        {
          providerId: "oidc",
          discoveryUrl: input.oidcDiscoveryUrl,
          issuer: input.oidcIssuer,
          clientId: input.authEnv.AUTH_OIDC_CLIENT_ID ?? "",
          clientSecret: input.authEnv.AUTH_OIDC_CLIENT_SECRET ?? "",
          scopes: [OAUTH_OPENID_SCOPE],
          pkce: true,
          mapProfileToUser: mapOidcProfileToUser,
        },
      ],
    }),
  ];
}
