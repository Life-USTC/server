import { jsonResponse } from "@/lib/api/responses";

/**
 * Responses from `/_internal/*` viewer endpoints depend on the session cookie.
 * They are never shared-cacheable and must vary on the cookie.
 */
export const PRIVATE_SESSION_HEADERS = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

/** Merge the private-session headers over any headers already in `init`. */
export function withPrivateSessionHeaders(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(PRIVATE_SESSION_HEADERS)) {
    headers.set(name, value);
  }
  return { ...init, headers };
}

export function privateSessionJson(body: unknown, init?: ResponseInit) {
  return jsonResponse(body, withPrivateSessionHeaders(init));
}

/**
 * Internal viewer endpoints accept the session cookie only. A Bearer token is
 * never an ambient identity for these routes, so reject any Authorization
 * header before resolving the viewer. Returns `null` when the request may
 * proceed.
 */
export function rejectBearerOnSessionRoute(request: Request) {
  if (!request.headers.has("authorization")) return null;
  return privateSessionJson(
    { error: "Session authentication required" },
    { status: 401 },
  );
}
