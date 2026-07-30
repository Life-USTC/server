export function buildUstcOidcProviderEndpoints(oidcIssuer: string) {
  const issuerBase = oidcIssuer.replace(/\/$/, "");

  return {
    authorizationUrl: `${issuerBase}/authorize/`,
    tokenUrl: `${issuerBase}/token/`,
    userInfoUrl: `${issuerBase}/userinfo/`,
  };
}
