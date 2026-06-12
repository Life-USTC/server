import { getAuthEnv } from "@/app-env";
import { getPublicOrigin } from "@/lib/site-url";

export const authEnv = getAuthEnv();
export const AUTH_PUBLIC_ORIGIN = getPublicOrigin();
export const AUTH_PUBLIC_PROTOCOL = getAuthPublicProtocol(AUTH_PUBLIC_ORIGIN);
export const OAUTH_PROXY_SECRET = authEnv.OAUTH_PROXY_SECRET;
export const OIDC_ISSUER =
  authEnv.AUTH_OIDC_ISSUER ?? "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2";
export const OIDC_DISCOVERY_URL = `${OIDC_ISSUER.replace(/\/$/, "")}/.well-known/openid-configuration`;

function getAuthPublicProtocol(origin: string): "http" | "https" {
  const protocol = new URL(origin).protocol;
  if (protocol === "http:" || protocol === "https:") {
    return protocol.slice(0, -1) as "http" | "https";
  }
  throw new Error(`Unsupported auth origin protocol: ${protocol}`);
}
