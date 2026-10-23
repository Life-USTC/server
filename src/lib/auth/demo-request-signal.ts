export const DEMO_COOKIE_NAME = "life-ustc.demo";
export const DEMO_ENTER_PATH = "/account/demo/enter";
export const DEMO_EXIT_PATH = "/account/demo/exit";

/** Presence is intentionally separate from Better Auth's request signal. */
export function hasDemoCookie(headers: Headers) {
  return (headers.get("cookie") ?? "")
    .split(";")
    .some((part) => part.trim().split("=", 1)[0] === DEMO_COOKIE_NAME);
}

export function isDemoRequest(request: Request) {
  const pathname = new URL(request.url).pathname;
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname).replace(/\/+$/, "");
  } catch {
    // Invalid URL encoding cannot match a SvelteKit route.
  }
  return (
    hasDemoCookie(request.headers) ||
    decodedPath === DEMO_ENTER_PATH ||
    decodedPath === DEMO_EXIT_PATH
  );
}
