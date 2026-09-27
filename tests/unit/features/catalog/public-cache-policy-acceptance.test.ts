import { describe, expect, test } from "vitest";
import { resolveCatalogListPublicSsrMode } from "@/features/catalog/lib/catalog-list-query";
import {
  catalogListReadCacheKey,
  catalogListReadCacheNamespace,
} from "@/features/catalog/server/catalog-list-cache";
import { publicCatalogKvCacheKey } from "@/lib/catalog-runtime-cache";
import {
  publicSsrCacheHeaders,
  resolvePublicSsrMode,
} from "@/lib/cloudflare/public-ssr-gateway";

function mode(path: string, headers: HeadersInit = {}) {
  return resolvePublicSsrMode(
    new Request(`https://life.example.edu${path}`, {
      headers: { accept: "text/html", ...headers },
    }),
    resolveCatalogListPublicSsrMode,
  );
}

describe("public cache policy acceptance", () => {
  test("rendering-and-cache.cacheable-public-pages-1", () => {
    for (const path of [
      "/catalog/courses",
      "/catalog/sections",
      "/catalog/teachers",
    ]) {
      expect(mode(path)).toBe("page");
      expect(mode(`${path}?unknownFilter=value`)).toBeNull();
    }
  });

  test("rendering-and-cache.cacheable-public-pages-2", () => {
    for (const kind of ["courses", "sections", "teachers"]) {
      expect(mode(`/catalog/${kind}/123`)).toBe("page");
      expect(mode(`/catalog/${kind}/123?sectionsPage=2`)).toBeNull();
      expect(mode(`/catalog/${kind}/0`)).not.toBe("page");
    }
  });

  test("rendering-and-cache.cacheable-public-pages-3", () => {
    expect(mode("/catalog/links")).toBe("page");
    expect(
      mode("/catalog/links", {
        cookie: "better-auth.session_token=viewer-session",
      }),
    ).toBe("page");
  });

  test("rendering-and-cache.cacheable-public-pages-4", () => {
    for (const path of [
      "/catalog/young-events",
      "/catalog/young-events/calendar",
      "/catalog/young-events/123",
      "/catalog/young-events/organizers",
      "/catalog/young-events/organizers/123",
    ]) {
      expect(mode(path)).toBe("page");
      expect(mode(`${path}?search=math`)).toBeNull();
    }
  });

  test("rendering-and-cache.cacheable-public-pages-5", () => {
    for (const path of [
      "/usage/mobile",
      "/usage/bot",
      "/usage/mcp",
      "/usage/cli",
      "/privacy",
      "/terms",
      "/guides/markdown-support",
      "/api-docs",
    ]) {
      expect(mode(path)).toBe("page");
    }
  });

  test("rendering-and-cache.cacheable-public-pages-6", () => {
    expect(mode("/account/sign-in")).toBe("page");
    expect(mode("/account/sign-in?callbackUrl=%2Fworkspace")).toBeNull();
    expect(
      mode("/account/sign-in", {
        cookie: "better-auth.session_token=viewer-session",
      }),
    ).toBeNull();
  });

  test("rendering-and-cache.cacheable-public-pages-7", () => {
    for (const path of [
      "/workspace/overview",
      "/account/settings/profile",
      "/account/welcome",
      "/admin/users",
      "/oauth/consent",
    ]) {
      expect(mode(path)).toBeNull();
    }
    for (const path of [
      "/catalog/courses/123",
      "/privacy",
      "/account/sign-in",
    ]) {
      expect(mode(path, { authorization: "Bearer opaque-token" })).toBeNull();
    }
  });

  test("rendering-and-cache.cacheable-public-pages-9", () => {
    for (const path of [
      "/catalog/courses/123/__data.json",
      "/catalog/sections/__data.json?x-sveltekit-invalidated=01",
      "/workspace/overview/__data.json",
    ]) {
      expect(mode(path, { accept: "application/json" })).toBeNull();
    }
  });

  test("rendering-and-cache.cacheable-public-pages-11", () => {
    for (const path of ["/catalog/bus", "/catalog/bus/map"]) {
      expect(mode(path)).toBeNull();
      expect(
        mode(path, { cookie: "better-auth.session_token=viewer-session" }),
      ).toBeNull();
    }
  });

  test("rendering-and-cache.cacheable-public-pages-13", () => {
    for (const path of [
      "/news",
      "/news/sources",
      "/search",
      "/search?q=math",
    ]) {
      expect(mode(path)).toBeNull();
    }
  });

  test("rendering-and-cache.personal-overlays-11", () => {
    for (const path of [
      "/_internal/shell-bootstrap",
      "/_internal/shell-bootstrap?viewer=other",
      "/_internal/other-endpoint",
    ]) {
      expect(mode(path)).toBeNull();
    }
  });

  test("rendering-and-cache.cache-layers-and-invalidation-2", () => {
    const headers = publicSsrCacheHeaders("/catalog/courses/123");
    expect(headers["Cache-Control"]).toMatch(/(?:^|,\s*)max-age=0(?:,|$)/);
    expect(headers["Cache-Control"]).toMatch(/(?:^|,\s*)s-maxage=86400(?:,|$)/);
  });

  test("rendering-and-cache.cache-layers-and-invalidation-3", () => {
    for (const path of [
      "/catalog/courses/123",
      "/catalog/teachers/123",
      "/privacy",
    ]) {
      const headers = publicSsrCacheHeaders(path);
      expect(headers["Cache-Control"]).toContain("s-maxage=86400");
      expect(headers["Cloudflare-CDN-Cache-Control"]).toMatch(
        /(?:^|,\s*)max-age=86400(?:,|$)/,
      );
    }
  });

  test("rendering-and-cache.cache-layers-and-invalidation-4", () => {
    const midday = new Date("2026-09-27T04:00:00.000Z");
    const midnightApproaching = new Date("2026-09-27T15:59:50.000Z");
    const midnightPassed = new Date("2026-09-27T16:00:01.000Z");
    for (const path of [
      "/catalog/young-events",
      "/catalog/young-events/calendar",
      "/catalog/young-events/123",
      "/catalog/young-events/organizers/123",
    ]) {
      expect(publicSsrCacheHeaders(path, midday)["Cache-Control"]).toContain(
        "s-maxage=60",
      );
      const before = publicSsrCacheHeaders(path, midnightApproaching);
      expect(before["Cache-Control"]).toContain("s-maxage=10");
      expect(before["Cache-Control"]).toContain("stale-while-revalidate=0");
      expect(
        publicSsrCacheHeaders(path, midnightPassed, midnightApproaching),
      ).toEqual({
        "Cache-Control": "private, no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
      });
    }
  });

  test("rendering-and-cache.cache-layers-and-invalidation-10", () => {
    const base = {
      filters: { search: "math", ids: [3, 1] },
      pagination: { page: 1, pageSize: 20 },
      shape: "summary",
    };
    const key = (
      revision: string,
      kind: "courses" | "sections",
      locale: "zh-cn" | "en-us",
      input = base,
    ) =>
      publicCatalogKvCacheKey(
        revision,
        catalogListReadCacheNamespace(kind, locale),
        catalogListReadCacheKey(input),
      );
    const baseline = key("revision-1", "courses", "zh-cn");
    expect(key("revision-2", "courses", "zh-cn")).not.toBe(baseline);
    expect(key("revision-1", "sections", "zh-cn")).not.toBe(baseline);
    expect(key("revision-1", "courses", "en-us")).not.toBe(baseline);
    expect(
      key("revision-1", "courses", "zh-cn", { ...base, shape: "full" }),
    ).not.toBe(baseline);
    expect(
      key("revision-1", "courses", "zh-cn", {
        ...base,
        filters: { search: "physics", ids: [3, 1] },
      }),
    ).not.toBe(baseline);
    expect(
      key("revision-1", "courses", "zh-cn", {
        ...base,
        filters: { ids: [1, 3], search: "math" },
      }),
    ).toBe(baseline);
  });
});
