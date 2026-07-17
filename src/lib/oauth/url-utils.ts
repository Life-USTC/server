export function uniqueUrls(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\/$/, "")))];
}

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function toUrl(target: URL | string): URL {
  return new URL(target.toString());
}

export function getLocalLoopbackSiblingUrl(target: string): string | null {
  const url = new URL(target);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
    return url.toString();
  }
  if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    return url.toString();
  }
  return null;
}

export function insertWellKnownPath(target: URL | string, suffix: string): URL {
  const url = toUrl(target);
  const normalizedPathname = normalizePathname(url.pathname);
  return new URL(
    `/.well-known/${suffix}${normalizedPathname}${url.search}`,
    `${url.origin}/`,
  );
}

export function appendWellKnownPath(target: URL | string, suffix: string): URL {
  const url = toUrl(target);
  const normalizedPathname = normalizePathname(url.pathname);
  return new URL(
    `${normalizedPathname}/.well-known/${suffix}${url.search}`,
    `${url.origin}/`,
  );
}
