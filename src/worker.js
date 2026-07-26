import { WorkerEntrypoint } from "cloudflare:workers";
import svelteKitWorker from "life-ustc-sveltekit-worker";
import {
  buildPublicNotFoundHtml,
  PUBLIC_SSR_HEADER,
  PUBLIC_SSR_LOCALE_CACHE_PARAM,
  PUBLIC_SSR_LOCALE_HEADER,
  PUBLIC_SSR_MODE_HEADER,
  PUBLIC_SSR_NONCE_PLACEHOLDER,
  removePublicSsrHeaders,
  resolvePublicSsrLocale,
  resolvePublicSsrMode,
} from "./lib/cloudflare/public-ssr-gateway";

const app = svelteKitWorker;

function cacheablePublicResponse(response, mode) {
  const isExpectedStatus =
    (mode === "page" && response.status >= 200 && response.status < 300) ||
    (mode === "not-found" && response.status === 404);
  return (
    isExpectedStatus &&
    response.headers.get("content-type")?.includes("text/html") &&
    !response.headers.has("set-cookie")
  );
}

function prepareCachedRepresentation(response, mode, locale, headRequest) {
  if (!cacheablePublicResponse(response, mode)) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=0, stale-while-revalidate=300");
  headers.set(
    "Cloudflare-CDN-Cache-Control",
    mode === "not-found"
      ? "public, max-age=300, stale-while-revalidate=3600"
      : "public, max-age=60, stale-while-revalidate=300",
  );
  headers.delete("Vary");
  headers.delete("Content-Length");
  if (mode === "not-found") headers.delete("Content-Encoding");
  return new Response(
    mode === "not-found" && !headRequest
      ? buildPublicNotFoundHtml(locale)
      : response.body,
    { headers, status: response.status, statusText: response.statusText },
  );
}

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
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

function publicSsrRequest(request, mode) {
  const locale = resolvePublicSsrLocale(request);
  const url = new URL(request.url);
  const canonicalQuery = new URLSearchParams();
  if (mode === "page") {
    for (const key of Array.from(new Set(url.searchParams.keys())).sort()) {
      const value = url.searchParams.get(key);
      if (value !== null) canonicalQuery.set(key, value);
    }
  }
  url.search = canonicalQuery.toString();
  url.searchParams.set(PUBLIC_SSR_LOCALE_CACHE_PARAM, locale);
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
  return new Request(url, request);
}

export class PublicSsr extends WorkerEntrypoint {
  async fetch(request) {
    const response = await app.fetch(
      svelteKitPublicSsrRequest(request),
      this.env,
      this.ctx,
    );
    const mode = request.headers.get(PUBLIC_SSR_MODE_HEADER);
    return prepareCachedRepresentation(
      response,
      mode === "not-found" ? "not-found" : "page",
      request.headers.get(PUBLIC_SSR_LOCALE_HEADER) === "en-us"
        ? "en-us"
        : "zh-cn",
      request.method === "HEAD",
    );
  }
}

export default {
  async fetch(request, env, context) {
    const mode = resolvePublicSsrMode(request);
    if (!mode) return app.fetch(directRequest(request), env, context);

    const response = await context.exports.PublicSsr.fetch(
      publicSsrRequest(request, mode),
    );
    return personalizeCachedResponse(response);
  },
};
