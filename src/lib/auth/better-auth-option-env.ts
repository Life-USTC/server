import { getAuthEnv } from "@/app-env";
import { getPublicOrigin } from "@/lib/site-url";

export function getBetterAuthOptionEnv() {
  const authEnv = getAuthEnv();
  const authPublicOrigin = getPublicOrigin();
  const oidcIssuer =
    authEnv.AUTH_OIDC_ISSUER ?? "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2";

  return {
    authEnv,
    authPublicOrigin,
    authPublicProtocol: getAuthPublicProtocol(authPublicOrigin),
    oauthProxySecret: authEnv.OAUTH_PROXY_SECRET,
    oidcIssuer,
    oidcDiscoveryUrl: `${oidcIssuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
  };
}

function getAuthPublicProtocol(origin: string): "http" | "https" {
  const protocol = new URL(origin).protocol;
  if (protocol === "http:" || protocol === "https:") {
    return protocol.slice(0, -1) as "http" | "https";
  }
  throw new Error(`Unsupported auth origin protocol: ${protocol}`);
}
