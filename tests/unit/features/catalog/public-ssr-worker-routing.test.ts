import { describe, expect, test } from "vitest";
import { resolveCatalogListPublicSsrMode } from "@/features/catalog/lib/catalog-list-query";
import {
  resolvePublicSsrMode as resolveBasePublicSsrMode,
  shouldRoutePublicSsrCache,
} from "@/lib/cloudflare/public-ssr-gateway";

function resolvePublicSsrMode(request: Request) {
  return resolveBasePublicSsrMode(request, resolveCatalogListPublicSsrMode);
}

function workerSsrRoute(request: Request) {
  const mode = resolvePublicSsrMode(request);
  return shouldRoutePublicSsrCache(request, mode)
    ? "public-ssr"
    : "dynamic-ssr";
}

function request(path: string, headers: HeadersInit = {}) {
  return new Request(`https://life-ustc.test${path}`, {
    headers: { accept: "text/html", ...headers },
  });
}

describe("public SSR worker routing", () => {
  test.each([
    "/account/sign-in",
    "/catalog/courses",
    "/catalog/sections/159446",
    "/privacy",
  ])("serves anonymous %s through the PublicSsr cache path", (path) => {
    expect(workerSsrRoute(request(path))).toBe("public-ssr");
  });

  test("serves the request-time bus map through dynamic SSR", () => {
    expect(workerSsrRoute(request("/catalog/bus/map"))).toBe("dynamic-ssr");
  });

  test.each([
    "/account/sign-in?callbackUrl=%2Fworkspace%2Foverview",
    "/account/sign-in?reauth=1&callbackUrl=%2Fadmin%2Fbus",
    "/account/sign-in?client_id=client-1&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&state=state-1&code_challenge=challenge&code_challenge_method=S256",
  ])("keeps query-bearing sign-in dynamic %s", (path) => {
    expect(workerSsrRoute(request(path))).toBe("dynamic-ssr");
  });

  test.each([
    ["/catalog/courses", { cookie: "better-auth.session_token=session-token" }],
    ["/catalog/sections/159446", { authorization: "Bearer access-token" }],
    ["/account/sign-in", { cookie: "better-auth.session_token=session-token" }],
    ["/privacy", { cookie: "session=private" }],
    ["/wp-login.php", { cookie: "session=private" }],
  ])(
    "bypasses PublicSsr for authenticated document request %s",
    (path, headers) => {
      expect(workerSsrRoute(request(path, headers))).toBe("dynamic-ssr");
    },
  );
});
