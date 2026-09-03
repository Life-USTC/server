import { WorkerEntrypoint } from "cloudflare:workers";
import svelteKitWorker from "life-ustc-sveltekit-worker";
import {
  maintainAuditLogRetention,
  maintainOAuthGrantUsageRetention,
} from "./features/admin/server/audit-retention";
import { cleanupExpiredAuthRecords } from "./features/auth/server/auth-record-cleanup";
import { handleCalendarExportRebuildBatch } from "./features/calendar/server/calendar-export-rebuild";
import {
  isCatalogListPath,
  normalizeCatalogListQuery,
  resolveCatalogListPublicSsrMode,
} from "./features/catalog/lib/catalog-list-query";
import { cleanupStaleUploadPendingStorage } from "./features/uploads/server/upload-pending-cleanup";
import { runWeatherCronSnapshot } from "./features/weather/server/weather-cron";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "./lib/adapters/cloudflare-runtime";
import { handleAuditLogWriteBatch } from "./lib/audit/audit-log-queue";
import { CATALOG_EDGE_CACHE_TAG } from "./lib/catalog-edge-cache-tag";
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
  resolveCourseDetailTabQueryRedirect,
  resolveCourseDetailTabRedirect,
  resolveLegacyCatalogRedirect,
  resolvePublicSsrLocale,
  resolvePublicSsrMode,
  resolveSectionDetailTabQueryRedirect,
  resolveSectionDetailTabRedirect,
  resolveTeacherDetailTabQueryRedirect,
  resolveTeacherDetailTabRedirect,
  shouldRoutePublicSsrCache,
} from "./lib/cloudflare/public-ssr-gateway";
import { maintenancePrisma } from "./lib/db/maintenance-prisma";
import { prisma } from "./lib/db/prisma";
import { elapsedMs, monotonicNowMs } from "./lib/log/observability-clock";
import {
  INTERNAL_REQUEST_ID_HEADER,
  logScheduledTaskError,
  logScheduledTaskFinish,
  logUnknownScheduledTask,
  logWorkerFetchError,
  logWorkerQueueError,
  logWorkerQueueFinish,
  normalizePublicSsrObservedRoute,
  normalizeWorkerObservedRoute,
  observedEdgeResponse,
  resolveEdgeCacheOutcome,
  resolveWorkerQueue,
  setTrustedRequestIdHeader,
} from "./lib/log/worker-entrypoint-observability";
import { buildContentSecurityPolicy } from "./lib/security/csp";
import { CONTENT_SIGNAL } from "./lib/seo/content-signal";

const app = svelteKitWorker;
const UPLOAD_PENDING_CLEANUP_CRON = "7 */2 * * *";
const AUTH_RECORD_CLEANUP_CRON = "23 */6 * * *";
const WEATHER_MAIN_CRON = "*/20 * * * *";
const WEATHER_GAOXIN_CRON = "*/30 * * * *";

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
  headers.set("Cache-Tag", CATALOG_EDGE_CACHE_TAG);
  headers.delete("Vary");
  headers.delete("Content-Length");
  headers.delete("x-request-id");
  headers.delete(INTERNAL_REQUEST_ID_HEADER);
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

function personalizeCachedResponse(response, requestId) {
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
  headers.delete(INTERNAL_REQUEST_ID_HEADER);
  headers.set("x-request-id", requestId);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("Vary", "Accept-Language, Cookie");

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

function directRequest(request, requestId) {
  if (
    !request.headers.has(PUBLIC_SSR_HEADER) &&
    !request.headers.has(PUBLIC_SSR_LOCALE_HEADER) &&
    !request.headers.has(PUBLIC_SSR_MODE_HEADER) &&
    !request.headers.has(INTERNAL_REQUEST_ID_HEADER) &&
    !request.headers.has("x-request-id")
  ) {
    return {
      cancel: async () => {},
      request,
    };
  }

  const headers = new Headers(request.headers);
  removePublicSsrHeaders(headers);
  setTrustedRequestIdHeader(headers, requestId);
  if (!request.body) {
    return {
      cancel: async () => {},
      request: new Request(request, { headers }),
    };
  }

  // Request cloning tees the incoming body. If the app returns early (for
  // example on an unauthenticated mutation), the unconsumed tee branch can
  // restart the Worker while the response is being returned. Transfer the
  // stream through one reader instead, and release it after app.fetch settles.
  const reader = request.body.getReader();
  let released = false;
  const transferredBody = new ReadableStream({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (released) return;
        if (chunk.done) {
          released = true;
          controller.close();
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        released = true;
        controller.error(error);
      }
    },
    async cancel(reason) {
      if (released) return;
      released = true;
      await reader.cancel(reason);
    },
  });
  const requestInit = {
    body: transferredBody,
    duplex: "half",
    headers,
  };
  let reconstructedRequest;
  try {
    reconstructedRequest = new Request(request, requestInit);
  } catch (error) {
    released = true;
    void reader.cancel("request reconstruction failed").catch(() => undefined);
    throw error;
  }
  return {
    cancel: async () => {
      if (released) return;
      released = true;
      await reader.cancel("request body released");
    },
    request: reconstructedRequest,
  };
}

function publicSsrRequest(request, mode, locale, requestId) {
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
  setTrustedRequestIdHeader(headers, requestId);
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

async function handleFetch(request, env, context, requestId, edgeObservation) {
  const startMs = monotonicNowMs();
  const finish = (response, requestClass, route, cacheOutcome = "bypass") => {
    edgeObservation.cacheOutcome = cacheOutcome;
    edgeObservation.requestClass = requestClass;
    edgeObservation.route = route;
    edgeObservation.completed = true;
    return observedEdgeResponse({
      cacheOutcome,
      request,
      requestClass,
      requestId,
      response,
      route,
      startMs,
    });
  };

  const legacyRedirect = resolveLegacyCatalogRedirect(request);
  if (legacyRedirect) {
    return finish(
      new Response(null, {
        status: 301,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: legacyRedirect,
        },
      }),
      "catalog-redirect",
      "/:legacy-catalog-route",
    );
  }
  const sectionTabRedirect = resolveSectionDetailTabRedirect(request);
  if (sectionTabRedirect) {
    return finish(
      new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: sectionTabRedirect,
        },
      }),
      "catalog-redirect",
      "/catalog/sections/:id/:legacy-tab",
    );
  }
  const sectionTabQueryRedirect = resolveSectionDetailTabQueryRedirect(request);
  if (sectionTabQueryRedirect) {
    return finish(
      new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: sectionTabQueryRedirect,
        },
      }),
      "catalog-redirect",
      "/catalog/sections/:id",
    );
  }
  const courseTabRedirect = resolveCourseDetailTabRedirect(request);
  if (courseTabRedirect) {
    return finish(
      new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: courseTabRedirect,
        },
      }),
      "catalog-redirect",
      "/catalog/courses/:id/:legacy-tab",
    );
  }
  const courseTabQueryRedirect = resolveCourseDetailTabQueryRedirect(request);
  if (courseTabQueryRedirect) {
    return finish(
      new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: courseTabQueryRedirect,
        },
      }),
      "catalog-redirect",
      "/catalog/courses/:id",
    );
  }
  const teacherTabRedirect = resolveTeacherDetailTabRedirect(request);
  if (teacherTabRedirect) {
    return finish(
      new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: teacherTabRedirect,
        },
      }),
      "catalog-redirect",
      "/catalog/teachers/:id/:legacy-tab",
    );
  }
  const teacherTabQueryRedirect = resolveTeacherDetailTabQueryRedirect(request);
  if (teacherTabQueryRedirect) {
    return finish(
      new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=86400",
          Location: teacherTabQueryRedirect,
        },
      }),
      "catalog-redirect",
      "/catalog/teachers/:id",
    );
  }
  const mode = resolvePublicSsrMode(request, resolveCatalogListPublicSsrMode);
  if (!shouldRoutePublicSsrCache(request, mode)) {
    const route = normalizeWorkerObservedRoute(new URL(request.url).pathname);
    edgeObservation.cacheOutcome = "dynamic";
    edgeObservation.requestClass = "dynamic";
    edgeObservation.route = route;
    let forwardedRequest;
    let response;
    try {
      forwardedRequest = directRequest(request, requestId);
      response = await app.fetch(forwardedRequest.request, env, context);
    } finally {
      if (forwardedRequest) {
        await forwardedRequest.cancel().catch(() => undefined);
      }
    }
    return finish(response, "dynamic", route, "dynamic");
  }

  const locale = resolvePublicSsrLocale(request);
  if (mode === "not-found") {
    return finish(
      publicNotFoundResponse(locale, request.method === "HEAD"),
      "public-not-found",
      "public-not-found",
    );
  }
  const cachedRequest = publicSsrRequest(request, mode, locale, requestId);
  const cacheUrl = new URL(cachedRequest.url);
  edgeObservation.cacheOutcome = "unknown";
  edgeObservation.requestClass = "public-ssr-cache";
  edgeObservation.route = normalizePublicSsrObservedRoute(
    new URL(request.url).pathname,
  );
  const response = await context.exports
    .PublicSsr({ props: { locale, mode } })
    .fetch(cachedRequest, {
      cf: { cacheKey: cacheUrl.pathname + cacheUrl.search },
    });
  return finish(
    personalizeCachedResponse(response, requestId),
    "public-ssr-cache",
    normalizePublicSsrObservedRoute(new URL(request.url).pathname),
    resolveEdgeCacheOutcome(response),
  );
}

export default {
  async fetch(request, env, context) {
    const requestId = crypto.randomUUID();
    const startMs = monotonicNowMs();
    const edgeObservation = {
      cacheOutcome: "dynamic",
      completed: false,
      requestClass: "dynamic",
      route: normalizePublicSsrObservedRoute(new URL(request.url).pathname),
    };
    try {
      const response = await runWithCloudflareRuntimeEnv(
        env,
        () => {
          setCloudflareRequestContext({
            method: request.method,
            requestId,
            route: normalizePublicSsrObservedRoute(
              new URL(request.url).pathname,
            ),
          });
          return handleFetch(request, env, context, requestId, edgeObservation);
        },
        context,
      );
      return response;
    } catch (error) {
      if (!edgeObservation.completed) {
        edgeObservation.completed = true;
        observedEdgeResponse({
          cacheOutcome: edgeObservation.cacheOutcome,
          request,
          requestClass: edgeObservation.requestClass,
          requestId,
          response: new Response(null, { status: 500 }),
          route: edgeObservation.route,
          startMs,
        });
      }
      logWorkerFetchError({
        error,
        ioObservedDurationMs: elapsedMs(startMs),
        requestId,
      });
      throw error;
    }
  },
  async queue(batch, env, context) {
    const startMs = monotonicNowMs();
    const queue = resolveWorkerQueue(batch.queue);
    try {
      const queueResult = await runWithCloudflareRuntimeEnv(
        env,
        () => {
          if (queue === "audit") {
            return handleAuditLogWriteBatch(batch);
          }
          if (queue === "calendar") {
            return handleCalendarExportRebuildBatch(batch);
          }
          throw new Error("Unsupported queue");
        },
        context,
      );
      logWorkerQueueFinish({
        ioObservedDurationMs: elapsedMs(startMs),
        messageCount: batch.messages.length,
        outcome: queueResult?.outcome,
        queue,
      });
    } catch (error) {
      logWorkerQueueError({
        error,
        ioObservedDurationMs: elapsedMs(startMs),
        messageCount: batch.messages.length,
        queue,
      });
      throw error;
    }
  },
  async scheduled(controller, env, context) {
    const startMs = monotonicNowMs();
    let task = "unknown";
    try {
      await runWithCloudflareRuntimeEnv(
        env,
        async () => {
          if (controller.cron === UPLOAD_PENDING_CLEANUP_CRON) {
            task = "upload-pending-cleanup";
            const report = await cleanupStaleUploadPendingStorage(prisma);
            logScheduledTaskFinish(task, report, elapsedMs(startMs));
            return;
          }

          if (controller.cron === AUTH_RECORD_CLEANUP_CRON) {
            task = "auth-and-audit-retention";
            const [authRecords, auditLog, oauthUsage] = await Promise.all([
              cleanupExpiredAuthRecords(maintenancePrisma),
              maintainAuditLogRetention(maintenancePrisma),
              maintainOAuthGrantUsageRetention(maintenancePrisma),
            ]);
            logScheduledTaskFinish(
              task,
              {
                ...authRecords,
                ...auditLog,
                ...oauthUsage,
              },
              elapsedMs(startMs),
            );
            return;
          }

          if (controller.cron === WEATHER_MAIN_CRON) {
            task = "weather-refresh-ustc-main";
            const report = await runWeatherCronSnapshot("ustc-main");
            logScheduledTaskFinish(task, report, elapsedMs(startMs));
            return;
          }

          if (controller.cron === WEATHER_GAOXIN_CRON) {
            task = "weather-refresh-ustc-gaoxin";
            const report = await runWeatherCronSnapshot("ustc-gaoxin");
            logScheduledTaskFinish(task, report, elapsedMs(startMs));
            return;
          }

          logUnknownScheduledTask(elapsedMs(startMs));
        },
        context,
      );
    } catch (error) {
      logScheduledTaskError(task, elapsedMs(startMs), error);
      throw error;
    }
  },
};
