import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";

export const PUBLIC_SSR_HEADER = "x-life-public-ssr";
export const PUBLIC_SSR_LOCALE_HEADER = "x-life-public-ssr-locale";
export const PUBLIC_SSR_MODE_HEADER = "x-life-public-ssr-mode";
export const PUBLIC_SSR_NONCE_PLACEHOLDER = "life-ustc-public-ssr-nonce";
export const PUBLIC_SSR_LOCALE_CACHE_PARAM = "__life_locale";
export const PUBLIC_SSR_MODE_CACHE_PARAM = "__life_mode";
export const PUBLIC_SSR_BROWSER_CACHE_CONTROL =
  "public, max-age=0, stale-while-revalidate=300, stale-if-error=0";
export const PUBLIC_SSR_PAGE_EDGE_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300, stale-if-error=0";

export type PublicSsrMode = "page" | "not-found";
export type PublicSsrLocale = "en-us" | "zh-cn";
export type PublicSsrRouteResolver = (
  url: URL,
) => PublicSsrMode | null | undefined;

const STATIC_PUBLIC_PATHS = new Set([
  "/catalog/bus/map",
  "/guides/markdown-support",
  "/api-docs",
  "/mobile-app",
  "/privacy",
  "/terms",
]);
const STATIC_PUBLIC_ROOTS = ["/api/docs"];
const DIRECT_REQUEST_PATHS = new Set([
  "/",
  "/error",
  "/llms.txt",
  "/open-graph.png",
  "/robots.txt",
  "/sitemap.xml",
]);

const CATALOG_DETAIL_PATH =
  /^\/catalog\/(courses|sections|teachers)\/([1-9]\d*)(?:\/([^/]+))?$/;
const CATALOG_DETAIL_SECTIONS: Record<string, ReadonlySet<string>> = {
  courses: new Set(["introduction", "sections", "comments"]),
  sections: new Set([
    "introduction",
    "calendar",
    "exams",
    "homework",
    "teachers",
    "comments",
  ]),
  teachers: new Set(["introduction", "sections", "comments"]),
};

const DYNAMIC_OR_PRIVATE_ROOTS = [
  "/account",
  "/admin",
  "/api",
  "/catalog",
  "/community",
  "/e2e",
  "/oauth",
  "/workspace",
];

const LEGACY_CATALOG_PATH = /^\/(sections|courses|teachers)\/(.+)$/;

export function resolveLegacyCatalogRedirect(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const match = LEGACY_CATALOG_PATH.exec(url.pathname);
  if (!match) return null;
  return `/catalog/${match[1]}/${match[2]}${url.search}`;
}

function matchesPathRoot(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function acceptsHtml(request: Request) {
  const accept = request.headers.get("accept");
  return (
    !accept ||
    accept === "*/*" ||
    accept.includes("text/html") ||
    request.headers.get("sec-fetch-dest") === "document"
  );
}

function isCanonicalCatalogDetailPath(pathname: string) {
  const match = CATALOG_DETAIL_PATH.exec(pathname);
  if (!match) return false;
  const [, collection, identifier, section] = match;
  const id = Number(identifier);
  if (!Number.isSafeInteger(id)) return false;
  return !section || CATALOG_DETAIL_SECTIONS[collection]?.has(section) === true;
}

export function resolvePublicSsrMode(
  request: Request,
  resolveFeatureRoute?: PublicSsrRouteResolver,
): PublicSsrMode | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!acceptsHtml(request)) return null;

  const url = new URL(request.url);
  if (url.pathname.endsWith("/__data.json")) return null;

  const featureMode = resolveFeatureRoute?.(url);
  if (featureMode !== undefined) return featureMode;

  if (isCanonicalCatalogDetailPath(url.pathname)) {
    return !url.search && !hasRequestAuthSignal(request.headers)
      ? "page"
      : null;
  }

  if (
    STATIC_PUBLIC_PATHS.has(url.pathname) ||
    STATIC_PUBLIC_ROOTS.some((root) => matchesPathRoot(url.pathname, root))
  ) {
    return url.search ? null : "page";
  }

  if (
    DIRECT_REQUEST_PATHS.has(url.pathname) ||
    url.pathname.startsWith("/_app/") ||
    url.pathname.startsWith("/.well-known/") ||
    DYNAMIC_OR_PRIVATE_ROOTS.some((root) => matchesPathRoot(url.pathname, root))
  ) {
    return null;
  }

  return "not-found";
}

function cookieValue(cookieHeader: string | null, name: string) {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(valueParts.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function resolvePublicSsrLocale(request: Request): PublicSsrLocale {
  const cookieLocale = cookieValue(
    request.headers.get("cookie"),
    "NEXT_LOCALE",
  );
  if (cookieLocale === "en-us" || cookieLocale === "zh-cn") {
    return cookieLocale;
  }

  const languages = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [locale = "", quality] = part.trim().toLowerCase().split(";q=");
      return {
        locale,
        quality: quality === undefined ? 1 : Number.parseFloat(quality),
      };
    })
    .filter(({ quality }) => Number.isFinite(quality))
    .sort((left, right) => right.quality - left.quality);

  for (const { locale } of languages) {
    if (locale === "en-us" || locale.startsWith("en-")) return "en-us";
    if (locale === "zh-cn" || locale.startsWith("zh-")) return "zh-cn";
  }
  return "zh-cn";
}

export function removePublicSsrHeaders(headers: Headers) {
  headers.delete(PUBLIC_SSR_HEADER);
  headers.delete(PUBLIC_SSR_LOCALE_HEADER);
  headers.delete(PUBLIC_SSR_MODE_HEADER);
}

export function buildPublicNotFoundHtml(locale: PublicSsrLocale) {
  const copy =
    locale === "en-us"
      ? {
          backHome: "Back to home",
          description: "The page you requested does not exist.",
          title: "Page not found",
        }
      : {
          backHome: "返回首页",
          description: "你访问的页面不存在。",
          title: "页面不存在",
        };

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title} - Life@USTC</title><style>html{color-scheme:light dark;font-family:ui-sans-serif,system-ui,sans-serif}body{display:grid;min-height:100vh;margin:0;place-items:center;background:#f8fafc;color:#0f172a}main{max-width:32rem;padding:2rem;text-align:center}p{color:#64748b}a{display:inline-block;margin-top:1rem;border-radius:.5rem;background:#0f172a;color:#fff;padding:.7rem 1rem;text-decoration:none}@media(prefers-color-scheme:dark){body{background:#020617;color:#f8fafc}p{color:#94a3b8}a{background:#f8fafc;color:#0f172a}}</style></head><body><main><h1>${copy.title}</h1><p>${copy.description}</p><a href="/">${copy.backHome}</a></main></body></html>`;
}
