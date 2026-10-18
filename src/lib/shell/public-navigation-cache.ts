import {
  isPublicNavigationPath,
  isSuccessfulPublicNavigationData,
  PUBLIC_NAVIGATION_HEADER,
} from "./public-navigation-contract";

const entries = new Map<
  string,
  { body: Uint8Array; exp: number; status: number; type: string | null }
>();
let generation = 0;

function pagePath(pathname: string) {
  if (pathname === "/__data.json") return "/";
  if (!pathname.endsWith("/__data.json")) return "";
  return pathname.slice(0, -"/__data.json".length) || "/";
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
  return Math.min(60_000, left);
}

/** Reuses one tab's public navigation responses. HTTP responses stay no-store. */
export async function cachedPublicNavigationFetch(
  original: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  now = Date.now(),
  locale = "",
): Promise<Response> {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    globalThis.location?.href,
  );
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (
    method === "POST" &&
    url.origin === globalThis.location?.origin &&
    (url.pathname === "/account/sign-out" ||
      url.pathname === "/api/auth/sign-out")
  ) {
    const response = await original(input, init);
    if (response.ok || response.status === 303) clearPublicNavigationCache();
    return response;
  }
  const path = pagePath(url.pathname);
  if (method !== "GET" || !path || !isPublicNavigationPath(path)) {
    return original(input, init);
  }
  const mask = url.searchParams.get("x-sveltekit-invalidated");
  const prefix = `${locale} ${url.origin}${url.pathname}`;
  if (mask !== null && /^1+$/.test(mask)) {
    generation++;
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
  const requestGeneration = generation;
  const response = await original(input, { ...init, cache: "no-store" });
  if (
    !response.ok ||
    response.headers.get(PUBLIC_NAVIGATION_HEADER) !== "1" ||
    response.headers.get("content-type")?.split(";", 1)[0].trim() !==
      "application/json"
  ) {
    return response;
  }
  // Streaming data may fail after its first node. Leave its body untouched.
  const body = new Uint8Array(await response.arrayBuffer());
  let reusable = false;
  try {
    reusable = isSuccessfulPublicNavigationData(
      JSON.parse(new TextDecoder().decode(body)),
    );
  } catch {
    // Preserve the response so SvelteKit owns malformed-protocol handling.
  }
  if (!reusable || requestGeneration !== generation) {
    return new Response(body, response);
  }
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

/** Drop stored entries and prevent outstanding responses from restoring them. */
export function clearPublicNavigationCache() {
  generation++;
  entries.clear();
}
