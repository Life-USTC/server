const LOOPBACK_HOST_FAMILY_BY_HOSTNAME = new Map<string, "ipv4" | "ipv6">([
  ["127.0.0.1", "ipv4"],
  ["localhost", "ipv4"],
  ["[::1]", "ipv6"],
  ["::1", "ipv6"],
]);
const STRICT_REDIRECT_URL_PARTS = [
  "protocol",
  "port",
  "pathname",
  "search",
  "hash",
] as const;

function getLoopbackHostFamily(hostname: string): "ipv4" | "ipv6" | null {
  return LOOPBACK_HOST_FAMILY_BY_HOSTNAME.get(hostname) ?? null;
}

function hasSameRedirectTarget(registeredUrl: URL, requestedUrl: URL) {
  return STRICT_REDIRECT_URL_PARTS.every(
    (part) => registeredUrl[part] === requestedUrl[part],
  );
}

function parseUrlOrNull(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Better Auth compares redirect URIs as exact strings. For public native
 * clients using loopback redirects, allow localhost/127.0.0.1 aliasing while
 * keeping scheme, port, path, query, and fragment strict.
 */
export function resolveEquivalentLoopbackRedirectUri(
  registeredRedirectUris: string[],
  requestedRedirectUri: string,
): string | null {
  const requestedUrl = parseUrlOrNull(requestedRedirectUri);
  if (!requestedUrl) {
    return null;
  }

  const requestedFamily = getLoopbackHostFamily(requestedUrl.hostname);
  if (!requestedFamily) {
    return null;
  }

  for (const registeredRedirectUri of registeredRedirectUris) {
    const registeredUrl = parseUrlOrNull(registeredRedirectUri);
    if (!registeredUrl) {
      continue;
    }

    if (getLoopbackHostFamily(registeredUrl.hostname) !== requestedFamily) {
      continue;
    }
    if (!hasSameRedirectTarget(registeredUrl, requestedUrl)) {
      continue;
    }

    return registeredRedirectUri;
  }

  return null;
}
