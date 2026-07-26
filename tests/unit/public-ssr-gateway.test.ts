import { describe, expect, test } from "vitest";
import {
  buildPublicNotFoundHtml,
  resolvePublicSsrLocale,
  resolvePublicSsrMode,
} from "@/lib/cloudflare/public-ssr-gateway";

function request(path: string, headers: HeadersInit = {}) {
  return new Request(`https://life-ustc.test${path}`, {
    headers: { accept: "text/html", ...headers },
  });
}

describe("public SSR gateway", () => {
  test.each([
    "/catalog/courses",
    "/catalog/courses?page=2&search=math",
    "/catalog/sections?semesterId=301&teacher=Li",
    "/catalog/teachers?departmentId=1",
    "/catalog/bus/map",
    "/api/docs/rest/catalog",
    "/mobile-app",
    "/privacy",
    "/terms",
  ])("caches allowlisted anonymous page %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBe("page");
  });

  test.each([
    "/",
    "/account/sign-in",
    "/admin",
    "/api/auth/get-session",
    "/catalog/courses/011145",
    "/catalog/courses?unknown=value",
    "/catalog/courses?__life_locale=en-us",
    "/community/users/example",
    "/workspace/overview",
  ])("bypasses private or mixed route %s", (path) => {
    expect(resolvePublicSsrMode(request(path))).toBeNull();
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
