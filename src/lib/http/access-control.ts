import { getOptionalTrimmedEnv } from "@/app-env";

const LOCAL_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  return authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : null;
}

export function normalizeHostHeaderName(hostHeader: string) {
  if (hostHeader.startsWith("[")) {
    return hostHeader.slice(1, hostHeader.indexOf("]"));
  }

  return hostHeader.split(":")[0];
}

export function isLocalRequest(request: Request) {
  const url = new URL(request.url);
  const hostHeader = request.headers.get("host");
  const hostHeaderName = hostHeader
    ? normalizeHostHeaderName(hostHeader)
    : url.hostname;
  return LOCAL_HOSTS.has(url.hostname) || LOCAL_HOSTS.has(hostHeaderName);
}

export function canReadInternalEndpoint(
  request: Request,
  envNames: readonly string[],
) {
  if (isLocalRequest(request)) {
    return true;
  }

  const bearerToken = getBearerToken(request);
  return envNames.some((name) => {
    const expected = getOptionalTrimmedEnv(name);
    return Boolean(expected && bearerToken === expected);
  });
}
