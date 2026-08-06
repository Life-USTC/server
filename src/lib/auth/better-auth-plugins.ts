import { cimd } from "@better-auth/cimd";
import { genericOAuth, jwt, oAuthProxy } from "better-auth/plugins";
import type { getAuthEnv } from "@/app-env";
import { buildOAuthProviderPlugin } from "@/lib/auth/better-auth-oauth-provider-plugin";
import { buildBetterAuthPasskeyPlugin } from "@/lib/auth/better-auth-passkey-plugin";
import { allowCimdMetadataFetch } from "@/lib/auth/cimd-fetch-policy";
import {
  getOidcAccountSubject,
  mapOidcProfileToUser,
} from "@/lib/auth/oauth-profile";
import { buildUstcOidcProviderEndpoints } from "@/lib/auth/ustc-oidc-endpoints";
import { ustcOidcIdentityPlugin } from "@/lib/auth/ustc-oidc-identity-plugin";
import { stageUstcOidcIdentityFromProfile } from "@/lib/auth/ustc-oidc-identity-profile";
import { isWebhookLoginEnabled } from "@/lib/auth/webhook-login-handler";
import { webhookLoginPlugin } from "@/lib/auth/webhook-login-plugin";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import {
  OAUTH_EMAIL_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
} from "@/lib/oauth/constants";
import { getCanonicalOrigin } from "@/lib/site-url";

type AuthEnv = ReturnType<typeof getAuthEnv>;

export function buildBetterAuthPlugins(input: {
  authEnv: AuthEnv;
  authPublicOrigin: string;
  oauthProxySecret: string | undefined;
  oidcIssuer: string;
}) {
  const ustcOidcEndpoints = buildUstcOidcProviderEndpoints(input.oidcIssuer);
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
    ...(isWebhookLoginEnabled() ? [webhookLoginPlugin()] : []),
    buildBetterAuthPasskeyPlugin(),
    ustcOidcIdentityPlugin(),
    buildOAuthProviderPlugin({
      authPublicOrigin: input.authPublicOrigin,
    }),
    cimd({ allowFetch: allowCimdMetadataFetch }),
    genericOAuth({
      config: [
        {
          providerId: "oidc",
          ...ustcOidcEndpoints,
          clientId: input.authEnv.AUTH_OIDC_CLIENT_ID ?? "",
          clientSecret: input.authEnv.AUTH_OIDC_CLIENT_SECRET ?? "",
          scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE, OAUTH_EMAIL_SCOPE],
          pkce: true,
          accountIssuer: input.oidcIssuer,
          accountSubject: ({ profile }) => getOidcAccountSubject(profile),
          mapProfileToUser: (profile) => {
            stageUstcOidcIdentityFromProfile(profile);
            return mapOidcProfileToUser(profile);
          },
        },
      ],
    }),
  ];
}
