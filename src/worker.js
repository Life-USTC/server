import { WorkerEntrypoint } from "cloudflare:workers";
import svelteKitWorker from "life-ustc-sveltekit-worker";
import {
  isCatalogListPath,
  normalizeCatalogListQuery,
  resolveCatalogListPublicSsrMode,
} from "./features/catalog/lib/catalog-list-query";
import {
  buildPublicNotFoundHtml,
  PUBLIC_SSR_BROWSER_CACHE_CONTROL,
  PUBLIC_SSR_HEADER,
  PUBLIC_SSR_LOCALE_CACHE_PARAM,
  PUBLIC_SSR_LOCALE_HEADER,
  PUBLIC_SSR_MODE_CACHE_PARAM,
  PUBLIC_SSR_MODE_HEADER,
  PUBLIC_SSR_NONCE_PLACEHOLDER,
  PUBLIC_SSR_PAGE_EDGE_CACHE_CONTROL,
  removePublicSsrHeaders,
  resolveLegacyCatalogRedirect,
  resolvePublicSsrLocale,
  resolvePublicSsrMode,
  resolveSectionDetailTabRedirect,
} from "./lib/cloudflare/public-ssr-gateway";
import { buildContentSecurityPolicy } from "./lib/security/csp";
import { CONTENT_SIGNAL } from "./lib/seo/content-signal";

const app = svelteKitWorker;

function cacheablePublicResponse(response) {
  return (
    response.status >= 200 &&
    response.status < 300 &&
    response.headers.get("content-type")?.includes("text/html") &&
    !response.headers.has("set-cookie")
  );
}

function prepareCachedRepresentation(response) {
  if (!cacheablePublicResponse(response)) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", PUBLIC_SSR_BROWSER_CACHE_CONTROL);
  headers.set(
    "Cloudflare-CDN-Cache-Control",
    PUBLIC_SSR_PAGE_EDGE_CACHE_CONTROL,
  );
  headers.delete("Vary");
  headers.delete("Content-Length");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function publicNotFoundResponse(locale, headRequest) {
  const body = buildPublicNotFoundHtml(locale);
  return new Response(headRequest ? null : body, {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Content-Language": locale,
      "Content-Security-Policy": buildContentSecurityPolicy(createNonce()),
      "Content-Signal": CONTENT_SIGNAL,
      "Content-Type": "text/html; charset=utf-8",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      Vary: "Accept-Language, Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "x-request-id": crypto.randomUUID(),
    },
  });
}

class ScriptNonceRewriter {
  constructor(nonce) {
    this.nonce = nonce;
  }

  element(element) {
    element.setAttribute("nonce", this.nonce);
  }
}

function personalizeCachedResponse(response) {
  const nonce = createNonce();
  const headers = new Headers(response.headers);
  const csp = headers.get("Content-Security-Policy");
  if (csp) {
    headers.set(
      "Content-Security-Policy",
      csp.replaceAll(PUBLIC_SSR_NONCE_PLACEHOLDER, nonce),
    );
  }
  headers.delete("Content-Length");
  headers.delete("ETag");
  headers.delete("Server-Timing");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("Vary", "Accept-Language, Cookie");
  headers.set("x-request-id", crypto.randomUUID());

  const rewritten = new Response(response.body, {
    headers,
    status: response.status,
  });
  if (!headers.get("content-type")?.includes("text/html") || !response.body) {
    return rewritten;
  }
  return new HTMLRewriter()
    .on("script[nonce]", new ScriptNonceRewriter(nonce))
    .transform(rewritten);
}

function directRequest(request) {
  if (
    !request.headers.has(PUBLIC_SSR_HEADER) &&
    !request.headers.has(PUBLIC_SSR_LOCALE_HEADER) &&
    !request.headers.has(PUBLIC_SSR_MODE_HEADER)
  ) {
    return request;
  }

  const headers = new Headers(request.headers);
  removePublicSsrHeaders(headers);
  return new Request(request, { headers });
}

function publicSsrRequest(request, mode, locale) {
  const url = new URL(request.url);
  const catalogListPath = isCatalogListPath(url.pathname);
  const canonicalQuery = catalogListPath
    ? normalizeCatalogListQuery(url.pathname, url.searchParams)
    : new URLSearchParams();
  if (mode === "page" && !catalogListPath) {
    for (const key of Array.from(new Set(url.searchParams.keys())).sort()) {
      const value = url.searchParams.get(key);
      if (value !== null) canonicalQuery.set(key, value);
    }
  }
  url.search = canonicalQuery.toString();
  url.searchParams.set(PUBLIC_SSR_LOCALE_CACHE_PARAM, locale);
  url.searchParams.set(PUBLIC_SSR_MODE_CACHE_PARAM, mode);
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("accept-encoding");
  removePublicSsrHeaders(headers);
  headers.set(PUBLIC_SSR_HEADER, "1");
  headers.set(PUBLIC_SSR_LOCALE_HEADER, locale);
  headers.set(PUBLIC_SSR_MODE_HEADER, mode);
  return new Request(url, {
    headers,
    method: request.method,
    redirect: "manual",
  });
}

function svelteKitPublicSsrRequest(request) {
  const url = new URL(request.url);
  url.searchParams.delete(PUBLIC_SSR_LOCALE_CACHE_PARAM);
  url.searchParams.delete(PUBLIC_SSR_MODE_CACHE_PARAM);
  return new Request(url, request);
}

export class PublicSsr extends WorkerEntrypoint {
  async fetch(request) {
    const response = await app.fetch(
      svelteKitPublicSsrRequest(request),
      this.env,
      this.ctx,
    );
    return prepareCachedRepresentation(response);
  }
}

export default {
  async fetch(request, env, context) {
    const legacyRedirect = resolveLegacyCatalogRedirect(request);
    if (legacyRedirect) {
      return new Response(null, {
        status: 301,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: legacyRedirect,
        },
      });
    }
    const sectionTabRedirect = resolveSectionDetailTabRedirect(request);
    if (sectionTabRedirect) {
      return new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: sectionTabRedirect,
        },
      });
    }
    const mode = resolvePublicSsrMode(request, resolveCatalogListPublicSsrMode);
    if (!mode) return app.fetch(directRequest(request), env, context);

    const locale = resolvePublicSsrLocale(request);
    if (mode === "not-found") {
      return publicNotFoundResponse(locale, request.method === "HEAD");
    }
    const cachedRequest = publicSsrRequest(request, mode, locale);
    const cacheUrl = new URL(cachedRequest.url);
    const response = await context.exports
      .PublicSsr({ props: { locale, mode } })
      .fetch(cachedRequest, {
        cf: { cacheKey: cacheUrl.pathname + cacheUrl.search },
      });
    return personalizeCachedResponse(response);
  },
};
