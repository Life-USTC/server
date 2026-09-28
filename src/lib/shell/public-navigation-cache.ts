const entries = new Map<
  string,
  { body: Uint8Array; exp: number; status: number; type: string | null }
>();

function pagePath(pathname: string) {
  if (pathname === "/__data.json") return "/";
  if (!pathname.endsWith("/__data.json")) return "";
  return pathname.slice(0, -"/__data.json".length) || "/";
}

function hot(pathname: string) {
  return (
    pathname !== "/catalog/bus" &&
    pathname !== "/catalog/bus/map" &&
    pathname !== "/catalog/weather" &&
    (pathname === "/catalog/courses" ||
      pathname === "/catalog/sections" ||
      pathname === "/catalog/teachers" ||
      pathname === "/catalog/links" ||
      pathname === "/catalog/rooms" ||
      pathname === "/search" ||
      pathname === "/news" ||
      pathname === "/news/sources" ||
      pathname === "/privacy" ||
      pathname === "/terms" ||
      pathname === "/guides/markdown-support" ||
      pathname === "/api-docs" ||
      pathname.startsWith("/usage/") ||
      /^\/catalog\/(?:courses|teachers)\/[1-9]\d*$/.test(pathname) ||
      /^\/catalog\/sections\/[1-9]\d*$/.test(pathname) ||
      pathname.startsWith("/catalog/young-events") ||
      /^\/news\/[^/]+$/.test(pathname) ||
      pathname.startsWith("/community/") ||
      pathname.startsWith("/api/docs/"))
  );
}

function lifetime(pathname: string, now: number) {
  if (
    !pathname.startsWith("/catalog/young-events") &&
    !pathname.startsWith("/catalog/sections/")
  ) {
    return 300_000;
  }
  const shanghai = new Date(now + 8 * 3_600_000);
  const left =
    86_400_000 -
    ((shanghai.getUTCHours() * 3600 +
      shanghai.getUTCMinutes() * 60 +
      shanghai.getUTCSeconds()) *
      1000 +
      shanghai.getUTCMilliseconds());
  return Math.min(60_000, Math.max(1_000, left));
}

/** Reuses one tab's public navigation responses. HTTP responses stay no-store. */
export async function cachedPublicNavigationFetch(
  original: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  now = Date.now(),
  locale = "",
): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url, "https://life.example");
  const path = pagePath(url.pathname);
  if (request.method !== "GET" || !path || !hot(path)) {
    return original(input, init);
  }
  const mask = url.searchParams.get("x-sveltekit-invalidated");
  const prefix = `${locale} ${url.pathname}`;
  if (mask !== null && /^1+$/.test(mask)) {
    for (const key of entries.keys()) {
      if (key.startsWith(prefix)) entries.delete(key);
    }
    return original(input, { ...init, cache: "no-store" });
  }
  const key = prefix + url.search;
  const hit = entries.get(key);
  if (hit && hit.exp > now) {
    return new Response(hit.body.slice(), {
      headers: hit.type ? { "content-type": hit.type } : {},
      status: hit.status,
    });
  }
  const response = await original(input, { ...init, cache: "no-store" });
  if (!response.ok || response.headers.has("set-cookie")) return response;
  const body = new Uint8Array(await response.arrayBuffer());
  entries.set(key, {
    body,
    exp: now + lifetime(path, now),
    status: response.status,
    type: response.headers.get("content-type"),
  });
  if (entries.size > 40) entries.delete(entries.keys().next().value ?? key);
  return new Response(body.slice(), {
    headers: response.headers,
    status: response.status,
  });
}

export function resetPublicNavigationCacheForTests() {
  entries.clear();
}
