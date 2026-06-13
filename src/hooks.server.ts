import { type Handle, type HandleServerError, redirect } from "@sveltejs/kit";
import { getOptionalTrimmedEnv } from "@/app-env";
import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import { shouldRedirectIncompleteProfileToWelcome } from "@/lib/auth/auth-routing";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { setCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime-env";
import {
  recordApiRequestStart,
  setApiRequestObservabilityContext,
} from "@/lib/log/api-observability";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
} from "@/lib/security/csp";

const TRUSTED_FORM_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://cf.life-ustc.tiankaima.dev",
  "https://life-ustc.tiankaima.dev",
];
const FORM_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FORM_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
];
const PUBLIC_PAGE_CACHE_PATHS = new Set(["/courses", "/sections", "/teachers"]);
type PublicCachePlatform = {
  caches?: { default?: Cache };
  context?: { waitUntil: (promise: Promise<unknown>) => void };
  ctx?: { waitUntil: (promise: Promise<unknown>) => void };
};

function configuredTrustedFormOrigins() {
  const publicOrigin = getOptionalTrimmedEnv("APP_PUBLIC_ORIGIN");
  return new Set(
    [...TRUSTED_FORM_ORIGINS, publicOrigin].filter((origin): origin is string =>
      Boolean(origin),
    ),
  );
}

function isFormContentType(request: Request) {
  const contentType = request.headers.get("content-type");
  return FORM_CONTENT_TYPES.some((type) => contentType?.includes(type));
}

function crossSiteFormResponse(event: Parameters<Handle>[0]["event"]) {
  if (getOptionalTrimmedEnv("NODE_ENV") === "development") return null;
  if (!FORM_METHODS.has(event.request.method)) return null;
  if (!isFormContentType(event.request)) return null;

  const requestOrigin = event.request.headers.get("origin");
  if (!requestOrigin) return null;
  if (requestOrigin === event.url.origin) return null;
  if (configuredTrustedFormOrigins().has(requestOrigin)) return null;

  const message = `Cross-site ${event.request.method} form submissions are forbidden`;
  if (event.request.headers.get("accept") === "application/json") {
    return Response.json({ message }, { status: 403 });
  }
  return new Response(message, { status: 403 });
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

function isHtmlResponse(response: Response) {
  return response.headers.get("content-type")?.includes("text/html");
}

function addScriptNonce(html: string, nonce: string) {
  return html.replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
}

function responseWithMutableHeaders(response: Response) {
  return new Response(response.body, response);
}

function prepareApiObservability(
  request: Request,
  pathname: string,
  requestId: string,
  startMs: number,
) {
  if (!isApiRequest(pathname)) return null;

  setApiRequestObservabilityContext(request, { requestId, startMs });
  recordApiRequestStart({
    method: request.method,
    pathname,
    requestId,
  });
  return { requestId };
}

function contentLength(response: Response) {
  const value = response.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function routeId(event: Parameters<Handle>[0]["event"]) {
  return event.route.id ?? event.url.pathname;
}

function isPublicPageCachePath(pathname: string) {
  return PUBLIC_PAGE_CACHE_PATHS.has(pathname);
}

function requestBypassesPublicCache(request: Request) {
  const cacheControl = request.headers.get("cache-control") ?? "";
  return (
    cacheControl.includes("no-cache") ||
    cacheControl.includes("no-store") ||
    request.headers.get("pragma") === "no-cache"
  );
}

function publicPageCacheForEvent(
  event: Parameters<Handle>[0]["event"],
  locale: string,
  hasAuthSignal: boolean,
) {
  if (event.request.method !== "GET") return null;
  if (hasAuthSignal) return null;
  if (!isPublicPageCachePath(event.url.pathname)) return null;
  if (requestBypassesPublicCache(event.request)) return null;

  const platform = event.platform as PublicCachePlatform | undefined;
  const cacheStorage =
    platform?.caches ?? (typeof caches === "undefined" ? undefined : caches);
  const cache = (cacheStorage as { default?: Cache } | undefined)?.default;
  if (!cache) return null;

  const cacheUrl = new URL(event.url);
  cacheUrl.searchParams.set("__life_ustc_locale", locale);
  return {
    cache,
    key: new Request(cacheUrl, { method: "GET" }),
  };
}

function cachedPublicPageResponse(input: {
  cached: Response;
  durationMs: number;
  event: Parameters<Handle>[0]["event"];
  requestId: string;
}) {
  const response = responseWithMutableHeaders(input.cached);
  response.headers.set("x-request-id", input.requestId);
  response.headers.set("x-life-ustc-cache", "HIT");
  logAppEvent("info", "public.page.cache.hit", {
    durationMs: input.durationMs,
    event: "public.page.cache.hit",
    method: input.event.request.method,
    requestId: input.requestId,
    route: input.event.url.pathname,
    source: "sveltekit",
    status: response.status,
  });
  return response;
}

function shouldStorePublicPageResponse(response: Response) {
  if (response.status !== 200) return false;
  if (response.headers.has("set-cookie")) return false;
  return isHtmlResponse(response);
}

function storePublicPageResponse(input: {
  cache: Cache;
  event: Parameters<Handle>[0]["event"];
  key: Request;
  response: Response;
}) {
  if (!shouldStorePublicPageResponse(input.response)) return;

  input.response.headers.set("x-life-ustc-cache", "MISS");

  const storePromise = input.cache.put(input.key, input.response.clone());
  const platform = input.event.platform as PublicCachePlatform | undefined;
  const context = platform?.ctx ?? platform?.context;
  if (context) {
    context.waitUntil(storePromise);
  } else {
    void storePromise.catch(() => {});
  }
}

function recordPageRequestFinish(input: {
  durationMs: number;
  event: Parameters<Handle>[0]["event"];
  requestId: string;
  response: Response;
}) {
  if (isApiRequest(input.event.url.pathname)) return;
  if (!isHtmlResponse(input.response)) return;

  logAppEvent("info", "page.request.finish", {
    durationMs: input.durationMs,
    event: "page.request.finish",
    method: input.event.request.method,
    requestId: input.requestId,
    responseBytes: contentLength(input.response),
    route: routeId(input.event),
    source: "sveltekit",
    status: input.response.status,
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  setCloudflareRuntimeEnv(
    (event.platform as { env?: unknown } | undefined)?.env,
  );

  const csrfResponse = crossSiteFormResponse(event);
  if (csrfResponse) return csrfResponse;

  const locale = negotiateLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language"),
  );
  event.locals.locale = locale;
  const requestId =
    event.request.headers.get("x-request-id") ?? crypto.randomUUID();
  event.locals.requestId = requestId;
  const startMs = Date.now();
  const hasAuthSignal = hasRequestAuthSignal(event.request.headers);
  const publicPageCache = publicPageCacheForEvent(event, locale, hasAuthSignal);
  const cachedPublicPage = publicPageCache
    ? await publicPageCache.cache.match(publicPageCache.key)
    : null;
  if (cachedPublicPage) {
    return cachedPublicPageResponse({
      cached: cachedPublicPage,
      durationMs: Date.now() - startMs,
      event,
      requestId,
    });
  }

  const apiObservability = prepareApiObservability(
    event.request,
    event.url.pathname,
    requestId,
    startMs,
  );
  const nonce = createScriptNonce();

  const session = hasAuthSignal
    ? await import("@/lib/auth/core").then(({ getSessionFromHeaders }) =>
        getSessionFromHeaders(event.request.headers),
      )
    : null;
  event.locals.authUser = session?.user ?? null;
  if (
    shouldRedirectIncompleteProfileToWelcome({
      pathname: event.url.pathname,
      url: event.url,
      hasUser: Boolean(session?.user.id),
      hasCompleteProfile: Boolean(session?.user.name && session.user.username),
    })
  ) {
    const returnTo = `${event.url.pathname}${event.url.search}`;
    throw redirect(303, `/welcome?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      addScriptNonce(
        html.replace('<html lang="zh-CN">', `<html lang="${locale}">`),
        nonce,
      ),
  });
  const shouldSetCsp = isHtmlResponse(response);
  recordPageRequestFinish({
    durationMs: Date.now() - startMs,
    event,
    requestId,
    response,
  });

  if (!apiObservability && !shouldSetCsp && !publicPageCache) {
    return response;
  }

  const mutableResponse = responseWithMutableHeaders(response);
  if (apiObservability) {
    mutableResponse.headers.set("x-request-id", apiObservability.requestId);
  } else if (shouldSetCsp) {
    mutableResponse.headers.set("x-request-id", requestId);
  }
  if (shouldSetCsp) {
    mutableResponse.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy(nonce, {
        isDevelopment: getOptionalTrimmedEnv("NODE_ENV") === "development",
      }),
    );
  }
  if (publicPageCache) {
    storePublicPageResponse({
      cache: publicPageCache.cache,
      event,
      key: publicPageCache.key,
      response: mutableResponse,
    });
  }

  return mutableResponse;
};

function sanitizeErrorText(value: string) {
  return value
    .replace(
      /\b(postgres(?:ql)?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi,
      "$1$2:<redacted>@",
    )
    .replace(
      /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*=)[^\s&]+/gi,
      "$1<redacted>",
    );
}

function serializeServerError(error: unknown) {
  if (!(error instanceof Error)) {
    return { value: sanitizeErrorText(String(error)) };
  }

  return {
    name: error.name,
    message: sanitizeErrorText(error.message),
    stack: error.stack ? sanitizeErrorText(error.stack) : undefined,
  };
}

export const handleError: HandleServerError = ({ error, event, status }) => {
  console.error(
    JSON.stringify({
      event: "sveltekit.server-error",
      method: event.request.method,
      path: event.url.pathname,
      status,
      error: serializeServerError(error),
    }),
  );

  return { message: "Internal Error" };
};
