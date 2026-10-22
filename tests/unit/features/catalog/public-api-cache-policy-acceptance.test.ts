import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { CATALOG_EDGE_CACHE_TAG } from "@/lib/catalog-edge-cache-tag";
import {
  cacheablePublicCatalogApiResponse,
  isStoredPublicCatalogApiRepresentation,
  PUBLIC_CATALOG_API_STORED_CACHE_CONTROL,
  PUBLIC_CATALOG_API_STRIPPED_REQUEST_HEADERS,
  resolvePublicCatalogApiCacheMode,
} from "@/lib/cloudflare/public-api-gateway";
import { PUBLIC_SSR_CACHE_PURGE_TAGS } from "@/lib/cloudflare/public-ssr-cache-purge";
import {
  currentSemesterCacheHeaders,
  PRIVATE_LOCALE_CATALOG_HEADERS,
  PUBLIC_BUS_CACHE_HEADERS,
  PUBLIC_CATALOG_HEADERS,
  PUBLIC_SEARCH_CACHE_HEADERS,
  TIME_SENSITIVE_PRIVATE_HEADERS,
} from "@/lib/public-cache-control";

const CATALOG_API_ROUTE_ROOT = "src/routes/api/catalog";

/**
 * Names that make a handler's answer depend on who is asking.
 * `getRequestLocale` reads the locale cookie, so a route using it cannot share
 * one representation across viewers the way `resolvePublicCatalogLocale` can.
 */
const VIEWER_DEPENDENT_NAMES = [
  "authUser",
  "cookies",
  "getRequestLocale",
  "requireAuth",
  "resolveSessionUserId",
];

function cacheMode(path: string, headers: HeadersInit = {}) {
  return resolvePublicCatalogApiCacheMode(
    new Request(`https://life.example.edu${path}`, { headers }),
  );
}

function jsonResponse(headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify({ items: [] }), {
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    status,
  });
}

/** Every `+server.ts` under the catalog API tree, with a concrete sample URL. */
function catalogApiRouteFiles(directory = CATALOG_API_ROUTE_ROOT): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return catalogApiRouteFiles(path);
    return entry === "+server.ts" ? [path] : [];
  });
}

function sampleRoutePath(routeFile: string) {
  return `/${routeFile
    .slice("src/routes/".length, -"/+server.ts".length)
    .split("/")
    .map((segment) =>
      segment.startsWith("[...")
        ? "sample/path"
        : segment.startsWith("[")
          ? "1"
          : segment,
    )
    .join("/")}`;
}

/**
 * The route file plus the bodies of the `@/lib/api/routes/*` handlers it
 * actually imports. Those adapter functions are where this codebase resolves
 * sessions and locales (`routes/bus.ts` is the live example), and slicing to
 * the imported names keeps a sibling route in the same module from being
 * blamed or from excusing the one under test.
 */
function namedFunctionSource(source: string, name: string) {
  const signature = new RegExp(
    `export (?:async )?function ${name}\\s*\\(`,
  ).exec(source);
  if (!signature) return "";
  let depth = 0;
  for (let index = signature.index; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(signature.index, index + 1);
    }
  }
  return source.slice(signature.index);
}

function routeHandlerSources(routeFile: string) {
  const entry = readFileSync(routeFile, "utf8");
  const imports = [
    ...entry.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*"@\/lib\/api\/routes\/([\w-]+)"/g,
    ),
  ].flatMap(([, names, module]) => {
    const source = readFileSync(`src/lib/api/routes/${module}.ts`, "utf8");
    return names
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name) => namedFunctionSource(source, name));
  });
  return [entry, ...imports].join("\n");
}

describe("public catalog API cache policy acceptance", () => {
  test("rendering-and-cache.cacheable-public-api-1", () => {
    for (const path of [
      "/api/catalog/courses",
      "/api/catalog/courses/1",
      "/api/catalog/links",
      "/api/catalog/metadata",
      "/api/catalog/schedules",
      "/api/catalog/sections",
      "/api/catalog/sections/159446",
      "/api/catalog/sections/159446/schedule-groups",
      "/api/catalog/sections/159446/schedules",
      "/api/catalog/semesters",
      "/api/catalog/teachers",
      "/api/catalog/teachers/42",
    ]) {
      expect(cacheMode(path), path).toBe("api");
      expect(cacheMode(`${path}?locale=en-us&page=2`), path).toBe("api");
      expect(
        cacheMode(path, {
          cookie: "better-auth.session_token=viewer-session",
        }),
        path,
      ).toBe("api");
    }

    for (const path of [
      "/api/catalog/bus",
      "/api/catalog/bus/next",
      "/api/catalog/bus/routes",
      "/api/catalog/rooms/5101/map",
      "/api/catalog/sections/0",
      "/api/catalog/sections/159446/calendar.ics",
      "/api/catalog/sections/calendar.ics",
      "/api/catalog/sections/match-codes",
      "/api/catalog/semesters/current",
      "/api/catalog/weather",
      "/api/catalog/young-events",
      "/api/catalog/young-events/abc",
      "/api/catalog/young-organizers",
      "/api/search",
      "/api/workspace/overview",
    ]) {
      expect(cacheMode(path), path).toBeNull();
    }

    expect(
      cacheMode("/api/catalog/metadata", {
        authorization: "Bearer access-token",
      }),
    ).toBeNull();
    for (const method of ["HEAD", "POST", "PUT", "DELETE"]) {
      expect(
        resolvePublicCatalogApiCacheMode(
          new Request("https://life.example.edu/api/catalog/sections", {
            method,
          }),
        ),
        method,
      ).toBeNull();
    }
  });

  test("rendering-and-cache.cacheable-public-api-2", () => {
    expect(
      cacheablePublicCatalogApiResponse(jsonResponse(PUBLIC_CATALOG_HEADERS)),
    ).toBe(true);
    expect(
      cacheablePublicCatalogApiResponse(
        jsonResponse({ ...PUBLIC_CATALOG_HEADERS, Vary: "Origin" }),
      ),
    ).toBe(true);

    // Every header set a catalog or community handler can choose other than
    // the public catalog one stays out of shared storage.
    for (const headers of [
      PRIVATE_LOCALE_CATALOG_HEADERS,
      PUBLIC_BUS_CACHE_HEADERS,
      PUBLIC_SEARCH_CACHE_HEADERS,
      TIME_SENSITIVE_PRIVATE_HEADERS,
      currentSemesterCacheHeaders(new Date("2026-03-04T05:06:07Z")),
    ]) {
      expect(
        cacheablePublicCatalogApiResponse(jsonResponse(headers)),
        JSON.stringify(headers),
      ).toBe(false);
    }

    for (const [label, response] of [
      [
        "set-cookie",
        jsonResponse({
          ...PUBLIC_CATALOG_HEADERS,
          "set-cookie": "better-auth.session_token=renewed; Path=/",
        }),
      ],
      [
        "vary on cookie",
        jsonResponse({ ...PUBLIC_CATALOG_HEADERS, Vary: "Origin, Cookie" }),
      ],
      [
        "vary on language",
        jsonResponse({ ...PUBLIC_CATALOG_HEADERS, Vary: "Accept-Language" }),
      ],
      [
        "vary on anything",
        jsonResponse({ ...PUBLIC_CATALOG_HEADERS, Vary: "*" }),
      ],
      [
        "missing cache tag",
        jsonResponse({ ...PUBLIC_CATALOG_HEADERS, "Cache-Tag": "" }),
      ],
      [
        "relaxed browser policy",
        jsonResponse({
          ...PUBLIC_CATALOG_HEADERS,
          "Cache-Control": "public, max-age=600",
        }),
      ],
      [
        "private browser policy",
        jsonResponse({
          ...PUBLIC_CATALOG_HEADERS,
          "Cache-Control": "private, no-store",
        }),
      ],
      [
        "private shared policy",
        jsonResponse({
          ...PUBLIC_CATALOG_HEADERS,
          "Cloudflare-CDN-Cache-Control": "no-store",
        }),
      ],
      ["not found", jsonResponse(PUBLIC_CATALOG_HEADERS, 404)],
      ["bad request", jsonResponse(PUBLIC_CATALOG_HEADERS, 400)],
      ["redirect", jsonResponse(PUBLIC_CATALOG_HEADERS, 307)],
      [
        "html body",
        new Response("<!doctype html>", {
          headers: { ...PUBLIC_CATALOG_HEADERS, "content-type": "text/html" },
        }),
      ],
      [
        "calendar body",
        new Response("BEGIN:VCALENDAR", {
          headers: {
            ...PUBLIC_CATALOG_HEADERS,
            "content-type": "text/calendar",
          },
        }),
      ],
    ] as const) {
      expect(cacheablePublicCatalogApiResponse(response), label).toBe(false);
    }

    expect([...PUBLIC_CATALOG_API_STRIPPED_REQUEST_HEADERS]).toEqual([
      "accept-encoding",
      "accept-language",
      "authorization",
      "cookie",
    ]);
  });

  test("rendering-and-cache.cacheable-public-api-2 route inventory", () => {
    const routeFiles = catalogApiRouteFiles();
    expect(routeFiles.length).toBeGreaterThan(20);

    const admitted = routeFiles.filter(
      (routeFile) => cacheMode(sampleRoutePath(routeFile)) === "api",
    );
    expect(admitted.length).toBeGreaterThan(8);
    for (const routeFile of admitted) {
      const source = routeHandlerSources(routeFile);
      for (const name of VIEWER_DEPENDENT_NAMES) {
        expect(source, `${routeFile} must not reference ${name}`).not.toContain(
          name,
        );
      }
    }

    // Canary: the shuttle-bus adapter really does resolve a session, so the
    // inventory check above cannot pass by matching nothing.
    const busSource = routeHandlerSources(
      `${CATALOG_API_ROUTE_ROOT}/bus/next/+server.ts`,
    );
    expect(busSource).toContain("resolveSessionUserId");
    expect(cacheMode("/api/catalog/bus/next")).toBeNull();
  });

  test("rendering-and-cache.cacheable-public-api-3", () => {
    expect(PUBLIC_CATALOG_API_STORED_CACHE_CONTROL).toMatch(/\bmax-age=0\b/);
    const sharedLifetime = /\bs-maxage=(\d+)/.exec(
      PUBLIC_CATALOG_API_STORED_CACHE_CONTROL,
    );
    expect(Number(sharedLifetime?.[1])).toBe(86_400);
    // Storage and invalidation must agree: the tag a stored JSON entry carries
    // has to be one the catalog purge endpoint actually invalidates, or a
    // committed import would leave a day-old catalog at the edge.
    expect(PUBLIC_CATALOG_HEADERS["Cache-Tag"]).toBe(CATALOG_EDGE_CACHE_TAG);
    expect([...PUBLIC_SSR_CACHE_PURGE_TAGS]).toContain(
      PUBLIC_CATALOG_HEADERS["Cache-Tag"],
    );
    expect(
      isStoredPublicCatalogApiRepresentation(
        jsonResponse({
          ...PUBLIC_CATALOG_HEADERS,
          "Cache-Control": PUBLIC_CATALOG_API_STORED_CACHE_CONTROL,
        }),
      ),
    ).toBe(true);
    expect(
      isStoredPublicCatalogApiRepresentation(
        jsonResponse(PRIVATE_LOCALE_CATALOG_HEADERS),
      ),
    ).toBe(false);
  });
});
