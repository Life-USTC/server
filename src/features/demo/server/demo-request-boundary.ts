import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import {
  DEMO_ENTER_PATH,
  DEMO_EXIT_PATH,
  hasDemoCookie,
  isDemoRequest,
} from "@/lib/auth/demo-request-signal";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { PUBLIC_NAVIGATION_HEADER } from "@/lib/shell/public-navigation-contract";
import { isDemoEnabled, readDemoSession } from "./demo-session";

export function setDemoPrivateHeaders(headers: Headers) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("Vary", "Cookie");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.delete(PUBLIC_NAVIGATION_HEADER);
}

function rejected(request: Request, status: number, code: string) {
  const response = new Response(
    request.method === "HEAD" ? null : JSON.stringify({ error: code }),
    { status, headers: { "content-type": "application/json; charset=utf-8" } },
  );
  setDemoPrivateHeaders(response.headers);
  return response;
}

type DemoBoundary = {
  identity: DemoIdentity | null;
  response?: Response;
  clearCookie?: boolean;
};

function isDemoCatalogPage(path: string) {
  return /^\/catalog\/(?:sections|courses|teachers)\/[1-9]\d*$/.test(path);
}

function isDemoCatalogRead(path: string) {
  return (
    isDemoCatalogPage(path.replace(/\/__data\.json$/, "")) ||
    /^\/api\/catalog\/sections\/[1-9]\d*$/.test(path) ||
    /^\/_internal\/catalog\/sections\/[1-9]\d*\/viewer$/.test(path) ||
    path === "/api/community/descriptions" ||
    path === "/api/community/comments"
  );
}

/** Runs before Better Auth, route adapters and durable request observations. */
export async function resolveDemoBoundary(
  request: Request,
  expectedControlPath?: typeof DEMO_ENTER_PATH | typeof DEMO_EXIT_PATH,
): Promise<DemoBoundary> {
  const url = new URL(request.url);
  const control =
    url.pathname === DEMO_ENTER_PATH || url.pathname === DEMO_EXIT_PATH;
  const present = hasDemoCookie(request.headers);
  const reject = (status: number, code: string): DemoBoundary => ({
    identity: null,
    response: rejected(request, status, code),
  });
  if (expectedControlPath && url.pathname !== expectedControlPath) {
    return reject(404, "DEMO_UNAVAILABLE");
  }
  if (!present && !control) {
    return isDemoRequest(request)
      ? reject(404, "DEMO_UNAVAILABLE")
      : { identity: null };
  }
  if (control) {
    if (request.method !== "POST") return reject(405, "METHOD_NOT_ALLOWED");
    if (request.headers.get("origin") !== url.origin) {
      return reject(403, "SAME_ORIGIN_REQUIRED");
    }
    // Exit only deletes the reserved cookie, even if it is invalid or mixed.
    if (url.pathname === DEMO_EXIT_PATH) return { identity: null };
  }
  if (!isDemoEnabled()) return reject(404, "DEMO_UNAVAILABLE");
  if (
    hasRequestAuthSignal(request.headers) ||
    request.headers.has("authorization")
  ) {
    return reject(403, "DEMO_IDENTITY_CONFLICT");
  }
  if (url.pathname === DEMO_ENTER_PATH) {
    return present ? reject(403, "DEMO_ALREADY_ENTERED") : { identity: null };
  }
  const identity = await readDemoSession(request.headers);
  if (!identity) {
    if (
      request.method === "GET" &&
      ([
        "/workspace/todos",
        "/workspace/subscriptions",
        "/workspace/homeworks",
      ].includes(url.pathname) ||
        isDemoCatalogPage(url.pathname)) &&
      request.headers.get("accept")?.includes("text/html")
    ) {
      const response = new Response(null, {
        status: 303,
        headers: { Location: "/account/sign-in" },
      });
      setDemoPrivateHeaders(response.headers);
      return { identity: null, response, clearCookie: true };
    }
    return reject(401, "DEMO_SESSION_INVALID");
  }
  // Existing language preference route changes only its own browser cookie.
  if (
    url.pathname === "/api/account/preferences" &&
    request.method === "POST"
  ) {
    return request.headers.get("origin") === url.origin
      ? { identity }
      : reject(403, "SAME_ORIGIN_REQUIRED");
  }
  const read = request.method === "GET" || request.method === "HEAD";
  if (
    !read ||
    (![
      "/workspace/todos",
      "/workspace/todos/__data.json",
      "/api/workspace/todos",
      "/workspace/subscriptions",
      "/workspace/subscriptions/__data.json",
      "/api/workspace/subscriptions/current",
      "/workspace/homeworks",
      "/workspace/homeworks/__data.json",
      "/api/workspace/homeworks",
      "/api/community/section-homeworks",
      "/api/community/section-homeworks/audit",
      "/_internal/shell-bootstrap",
    ].includes(url.pathname) &&
      !isDemoCatalogRead(url.pathname) &&
      !/^\/api\/community\/section-homeworks\/[^/]+$/.test(url.pathname))
  ) {
    return reject(403, "DEMO_READ_ONLY");
  }
  return { identity };
}
