import { describe, expect, test } from "vitest";
import { resolveCatalogListPublicSsrMode } from "@/features/catalog/lib/catalog-list-query";
import {
  buildPublicNotFoundHtml,
  PUBLIC_SSR_BROWSER_CACHE_CONTROL,
  PUBLIC_SSR_PAGE_EDGE_CACHE_CONTROL,
  resolvePublicSsrMode as resolveBasePublicSsrMode,
  resolveCourseDetailTabRedirect,
  resolveLegacyCatalogRedirect,
  resolvePublicSsrLocale,
  resolveSectionDetailTabRedirect,
  resolveTeacherDetailTabRedirect,
  shouldRoutePublicSsrCache,
} from "@/lib/cloudflare/public-ssr-gateway";

function resolvePublicSsrMode(request: Request) {
  return resolveBasePublicSsrMode(request, resolveCatalogListPublicSsrMode);
}

function request(path: string, headers: HeadersInit = {}) {
  return new Request(`https://life-ustc.test${path}`, {
    headers: { accept: "text/html", ...headers },
  });
}

describe("public SSR gateway", () => {
  test.each([
    PUBLIC_SSR_BROWSER_CACHE_CONTROL,
    PUBLIC_SSR_PAGE_EDGE_CACHE_CONTROL,
  ])("bounds stale-on-error cache fallback in %s", (cacheControl) => {
    expect(cacheControl).toContain("stale-if-error=0");
  });

  test.each([
    ["/sections/159446/comments", "/catalog/sections/159446/comments"],
    ["/courses/456?page=2", "/catalog/courses/456?page=2"],
    ["/teachers/abc123", "/catalog/teachers/abc123"],
  ])("redirects legacy catalog path %s before 404 handling", (path, target) => {
    expect(resolveLegacyCatalogRedirect(request(path))).toBe(target);
  });

  test.each([
    [
      "/catalog/sections/159446/introduction",
      "/catalog/sections/159446#introduction",
    ],
    [
      "/catalog/sections/159446/calendar?page=2",
      "/catalog/sections/159446?page=2#calendar",
    ],
    [
      "/catalog/courses/11145/introduction",
      "/catalog/courses/11145#introduction",
    ],
    [
      "/catalog/courses/11145/sections?page=2",
      "/catalog/courses/11145?page=2#sections",
    ],
    ["/catalog/teachers/42/comments", "/catalog/teachers/42#comments"],
  ])("redirects legacy catalog tab path %s to hash anchor", (path, target) => {
    const redirect =
      resolveSectionDetailTabRedirect(request(path)) ??
      resolveCourseDetailTabRedirect(request(path)) ??
      resolveTeacherDetailTabRedirect(request(path));
    expect(redirect).toBe(target);
  });

  test("does not redirect a non-read legacy request", () => {
    expect(
      resolveLegacyCatalogRedirect(
        new Request("https://life-ustc.test/sections/159446", {
          method: "POST",
        }),
      ),
    ).toBeNull();
  });

  test.each([
    "/catalog/courses",
    "/catalog/courses?page=2&search=math",
    "/catalog/courses?page=100&categoryId=7",
    "/catalog/courses?search=&educationLevelId=&categoryId=7&classTypeId=",
    "/catalog/sections?semesterId=301&teacher=Li",
    "/catalog/sections?credits=2.5&sort=credits&order=asc",
    "/catalog/sections?semesterId=301&teacher=&courseCode=&sectionCode=&campusId=&departmentId=&credits=&categoryId=&educationLevelId=&classTypeId=&sort=",
    "/catalog/teachers?departmentId=1",
    "/account/sign-in",
    "/api-docs",
    "/api/docs/rest/catalog",
    "/usage/mobile",
    "/usage/bot",
    "/usage/mcp",
    "/usage/cli",
    "/privacy",
    "/terms",
  ])("caches allowlisted anonymous page %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBe("page");
  });

  test("keeps the request-time bus map out of the 24-hour HTML cache", () => {
    expect(resolvePublicSsrMode(request("/catalog/bus/map"))).toBeNull();
  });

  test.each([
    "/catalog/courses/11145",
    "/catalog/teachers/42",
    "/catalog/sections/159446",
  ])("caches canonical anonymous catalog detail page %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBe("page");
  });

  test("caches the canonical anonymous sign-in HEAD request", () => {
    expect(
      resolvePublicSsrMode(
        new Request("https://life-ustc.test/account/sign-in", {
          headers: { accept: "text/html" },
          method: "HEAD",
        }),
      ),
    ).toBe("page");
  });

  test.each([
    "/catalog/courses/11145/introduction",
    "/catalog/courses/11145/sections",
    "/catalog/courses/11145/comments",
    "/catalog/teachers/42/introduction",
    "/catalog/teachers/42/sections",
    "/catalog/teachers/42/comments",
    "/catalog/sections/159446/introduction",
    "/catalog/sections/159446/calendar",
    "/catalog/sections/159446/exams",
    "/catalog/sections/159446/homework",
    "/catalog/sections/159446/teachers",
    "/catalog/sections/159446/comments",
  ])("bypasses legacy catalog tab path %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBeNull();
  });

  test("caches a canonical anonymous catalog detail HEAD request", () => {
    expect(
      resolvePublicSsrMode(
        new Request("https://life-ustc.test/catalog/courses/11145", {
          headers: { accept: "text/html" },
          method: "HEAD",
        }),
      ),
    ).toBe("page");
  });

  test.each([
    "/",
    "/_internal/shell-bootstrap",
    "/account/sign-in/",
    "/admin",
    "/api/auth/get-session",
    "/catalog/courses/011145",
    "/catalog/courses/11145/",
    "/catalog/courses/11145/calendar",
    "/catalog/courses/11145/comments?sort=latest",
    "/catalog/courses/11145/__data.json",
    "/catalog/courses?unknown=value",
    "/catalog/courses?__life_locale=en-us",
    "/catalog/courses?page=1",
    "/catalog/courses?page=5001",
    "/catalog/courses?page=2&page=3",
    "/catalog/courses?search=%20math",
    "/catalog/courses?categoryId=01",
    "/catalog/sections?sort=credits",
    "/catalog/sections?sort=unknown&order=asc",
    "/catalog/teachers?departmentId=0",
    "/catalog/sections/159446/unknown",
    "/catalog/teachers/not-an-id",
    "/community/users/example",
    "/e2e/oauth/callback?code=example&state=test",
    "/error?error=access_denied",
    "/llms.txt",
    "/news",
    "/news/example-publication",
    "/news?type=notice",
    "/open-graph.png",
    "/robots.txt",
    "/search",
    "/search?q=邮箱",
    "/sitemap.xml",
    "/workspace/overview",
  ])("bypasses private or mixed route %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBeNull();
  });

  test.each([
    "/account/sign-in?callbackUrl=%2Fworkspace%2Foverview",
    "/account/sign-in?reauth=1&callbackUrl=%2Fadmin%2Fbus",
    "/account/sign-in?client_id=client-1&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&state=state-1&code_challenge=challenge&code_challenge_method=S256",
    "/account/sign-in?error=OAuthAccountNotLinked",
  ])("keeps query-bearing sign-in dynamic %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBeNull();
  });

  test("keeps sign-in POST requests dynamic", () => {
    expect(
      resolvePublicSsrMode(
        new Request("https://life-ustc.test/account/sign-in", {
          headers: { accept: "text/html" },
          method: "POST",
        }),
      ),
    ).toBeNull();
  });

  test("treats the retired mobile-app path as not found", () => {
    expect(resolvePublicSsrMode(request("/mobile-app"))).toBe("not-found");
  });

  test.each<Record<string, string>>([
    { authorization: "Bearer access-token" },
    { authorization: "bEaReR access-token" },
    { cookie: "better-auth.session_token=session-token" },
    { cookie: "__Secure-better-auth.session_token=session-token" },
    { cookie: "session=private" },
  ])("bypasses catalog detail requests with auth signal %j", (headers) => {
    expect(
      resolvePublicSsrMode(request("/catalog/courses/11145", headers)),
    ).toBeNull();
  });

  test.each<Record<string, string>>([
    { authorization: "Bearer access-token" },
    { cookie: "better-auth.session_token=session-token" },
  ])("never caches authenticated sign-in requests %j", (headers) => {
    const authenticated = request("/account/sign-in", headers);
    expect(resolvePublicSsrMode(authenticated)).toBeNull();
    expect(shouldRoutePublicSsrCache(authenticated, "page")).toBe(false);
  });

  test.each([
    "/catalog/courses",
    "/catalog/sections",
    "/account/sign-in",
    "/privacy",
    "/wp-login.php",
  ])("bypasses public SSR cache routing for authenticated page %s", (path) => {
    const authenticated = request(path, {
      cookie: "better-auth.session_token=session-token",
    });
    expect(resolvePublicSsrMode(authenticated)).toBeNull();
    expect(shouldRoutePublicSsrCache(authenticated, "page")).toBe(false);
    expect(shouldRoutePublicSsrCache(authenticated, "not-found")).toBe(false);
  });

  test("routes anonymous catalog list pages through public SSR cache", () => {
    const anonymous = request("/catalog/courses");
    expect(resolvePublicSsrMode(anonymous)).toBe("page");
    expect(shouldRoutePublicSsrCache(anonymous, "page")).toBe(true);
    expect(shouldRoutePublicSsrCache(anonymous, null)).toBe(false);
  });

  test("bypasses non-read and non-document catalog detail requests", () => {
    expect(
      resolvePublicSsrMode(
        new Request("https://life-ustc.test/catalog/courses/11145", {
          headers: { accept: "text/html" },
          method: "POST",
        }),
      ),
    ).toBeNull();
    expect(
      resolvePublicSsrMode(
        new Request("https://life-ustc.test/catalog/courses/11145", {
          headers: { accept: "application/json" },
        }),
      ),
    ).toBeNull();
  });

  test("caches only the 404 representation for unknown roots", () => {
    expect(resolvePublicSsrMode(request("/wp-login.php"))).toBe("not-found");
  });

  test("bypasses SvelteKit data requests and non-document fetches", () => {
    expect(
      resolvePublicSsrMode(request("/catalog/courses/__data.json")),
    ).toBeNull();
    expect(
      resolvePublicSsrMode(
        new Request("https://life-ustc.test/privacy", {
          headers: { accept: "application/json" },
        }),
      ),
    ).toBeNull();
  });

  test("normalizes locale before cookies are removed", () => {
    expect(
      resolvePublicSsrLocale(
        request("/privacy", {
          "accept-language": "en-US,en;q=0.9",
          cookie: "session=private; NEXT_LOCALE=zh-cn",
        }),
      ),
    ).toBe("zh-cn");
    expect(
      resolvePublicSsrLocale(
        request("/privacy", { "accept-language": "en-GB,en;q=0.9" }),
      ),
    ).toBe("en-us");
  });

  test("renders a localized script-free not-found document", () => {
    const html = buildPublicNotFoundHtml("en-us");
    expect(html).toContain('<html lang="en-us">');
    expect(html).toContain("Page not found");
    expect(html).not.toContain("<script");
  });
});
