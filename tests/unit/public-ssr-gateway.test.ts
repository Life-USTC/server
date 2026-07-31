import { describe, expect, test } from "vitest";
import { resolveCatalogListPublicSsrMode } from "@/features/catalog/lib/catalog-list-query";
import {
  buildPublicNotFoundHtml,
  PUBLIC_SSR_BROWSER_CACHE_CONTROL,
  PUBLIC_SSR_PAGE_EDGE_CACHE_CONTROL,
  resolvePublicSsrMode as resolveBasePublicSsrMode,
  resolveLegacyCatalogRedirect,
  resolvePublicSsrLocale,
  resolveSectionDetailTabRedirect,
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
      "/catalog/sections/159446?tab=introduction",
    ],
    [
      "/catalog/sections/159446/calendar?page=2",
      "/catalog/sections/159446?page=2&tab=calendar",
    ],
  ])("redirects legacy section tab path %s to query tab", (path, target) => {
    expect(resolveSectionDetailTabRedirect(request(path))).toBe(target);
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
    "/catalog/courses?page=5000&categoryId=7",
    "/catalog/courses?search=&educationLevelId=&categoryId=7&classTypeId=",
    "/catalog/sections?semesterId=301&teacher=Li",
    "/catalog/sections?credits=2.5&sort=credits&order=asc",
    "/catalog/sections?semesterId=301&teacher=&courseCode=&sectionCode=&campusId=&departmentId=&credits=&categoryId=&educationLevelId=&classTypeId=&sort=",
    "/catalog/teachers?departmentId=1",
    "/catalog/bus/map",
    "/api-docs",
    "/api/docs/rest/catalog",
    "/mobile-app",
    "/privacy",
    "/terms",
  ])("caches allowlisted anonymous page %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBe("page");
  });

  test.each([
    "/catalog/courses/11145",
    "/catalog/courses/11145/introduction",
    "/catalog/courses/11145/sections",
    "/catalog/courses/11145/comments",
    "/catalog/teachers/42",
    "/catalog/teachers/42/introduction",
    "/catalog/teachers/42/sections",
    "/catalog/teachers/42/comments",
    "/catalog/sections/159446",
  ])("caches canonical anonymous catalog detail page %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBe("page");
  });

  test.each([
    "/catalog/sections/159446/introduction",
    "/catalog/sections/159446/calendar",
    "/catalog/sections/159446/exams",
    "/catalog/sections/159446/homework",
    "/catalog/sections/159446/teachers",
    "/catalog/sections/159446/comments",
  ])("bypasses legacy section tab path %s", (path) => {
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
    "/account/sign-in",
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
    "/open-graph.png",
    "/robots.txt",
    "/search",
    "/search?q=邮箱",
    "/sitemap.xml",
    "/workspace/overview",
  ])("bypasses private or mixed route %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBeNull();
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

  test("keeps viewer-independent catalog list caching with auth signals", () => {
    expect(
      resolvePublicSsrMode(
        request("/catalog/courses", {
          cookie: "better-auth.session_token=session-token",
        }),
      ),
    ).toBe("page");
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
