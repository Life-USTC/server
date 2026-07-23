import {
  type Handle,
  type HandleServerError,
  isRedirect,
  redirect,
} from "@sveltejs/kit";
import { getOptionalTrimmedEnv, loadEnv } from "@/app-env";
import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import {
  runCloudflareTraceSpan,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { shouldRedirectIncompleteProfileToWelcome } from "@/lib/auth/auth-routing";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import {
  recordApiRequestStart,
  recordObservedApiError,
  recordObservedApiResponse,
  setApiRequestObservabilityContext,
} from "@/lib/log/api-observability";
import { normalizeApiRoutePath } from "@/lib/log/api-observability-path";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import {
  appendPageServerTiming,
  recordPageRequestFinish,
} from "@/lib/metrics/page-observability";
import {
  OAUTH_DEVICE_AUTHORIZATION_ENDPOINT_PATH,
  OAUTH_TOKEN_ENDPOINT_PATH,
} from "@/lib/oauth/constants";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
  formActionSourceFromOAuthRedirectUri,
} from "@/lib/security/csp";
import { setContentSignal } from "@/lib/seo/content-signal";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const;
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
const OAUTH_FORM_CORS_ENDPOINTS = new Set([
  OAUTH_DEVICE_AUTHORIZATION_ENDPOINT_PATH,
  OAUTH_TOKEN_ENDPOINT_PATH,
]);

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

export function crossSiteFormResponse(event: Parameters<Handle>[0]["event"]) {
  if (getOptionalTrimmedEnv("NODE_ENV") === "development") return null;
  if (!FORM_METHODS.has(event.request.method)) return null;
  if (!isFormContentType(event.request)) return null;
  if (OAUTH_FORM_CORS_ENDPOINTS.has(event.url.pathname)) return null;

  const requestOrigin = event.request.headers.get("origin");
  if (!requestOrigin) return null;
  if (requestOrigin === event.url.origin) return null;
  if (configuredTrustedFormOrigins().has(requestOrigin)) return null;

  const message = `Cross-site ${event.request.method} form submissions are forbidden`;
  if (event.request.headers.get("accept")?.includes("application/json")) {
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

function setSecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

function responseWithSecurityHeaders(response: Response) {
  const mutableResponse = responseWithMutableHeaders(response);
  setSecurityHeaders(mutableResponse.headers);
  return mutableResponse;
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

function oauthAuthorizeFormActionSources(url: URL) {
  if (url.pathname !== "/oauth/authorize") return [];
  const source = formActionSourceFromOAuthRedirectUri(
    url.searchParams.get("redirect_uri"),
  );
  return source ? [source] : [];
}

const handleWithRuntimeEnv: Handle = async ({ event, resolve }) => {
  const locale = negotiateLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language"),
  );
  event.locals.locale = locale;
  const requestId = crypto.randomUUID();
  event.locals.requestId = requestId;
  const startMs = Date.now();
  const hasAuthSignal = hasRequestAuthSignal(event.request.headers);
  const apiObservability = prepareApiObservability(
    event.request,
    event.url.pathname,
    requestId,
    startMs,
  );

  try {
    loadEnv();
    const nonce = createScriptNonce();
    const csrfResponse = crossSiteFormResponse(event);
    if (csrfResponse) {
      const response = responseWithSecurityHeaders(csrfResponse);
      if (apiObservability) {
        recordObservedApiResponse(event.request, response.status);
        response.headers.set("x-request-id", requestId);
      }
      return response;
    }

    const authStartMs = Date.now();
    const session = hasAuthSignal
      ? await runCloudflareTraceSpan(
          "app.auth.session",
          { "app.auth.signal_present": true },
          () =>
            import("@/lib/auth/core").then(({ getSessionFromHeaders }) =>
              getSessionFromHeaders(event.request.headers),
            ),
        )
      : null;
    const authDurationMs = Date.now() - authStartMs;
    event.locals.authUser = session?.user ?? null;
    if (
      shouldRedirectIncompleteProfileToWelcome({
        pathname: event.url.pathname,
        url: event.url,
        hasUser: Boolean(session?.user.id),
        hasCompleteProfile: Boolean(
          session?.user.name && session.user.username,
        ),
      })
    ) {
      const returnTo = `${event.url.pathname}${event.url.search}`;
      throw redirect(
        303,
        `/welcome?callbackUrl=${encodeURIComponent(returnTo)}`,
      );
    }

    const appStartMs = Date.now();
    const response = await runCloudflareTraceSpan(
      "app.sveltekit.resolve",
      {
        "http.request.method": event.request.method,
        "http.route": isApiRequest(event.url.pathname)
          ? normalizeApiRoutePath(event.url.pathname)
          : (event.route.id ?? "unmatched"),
      },
      () =>
        resolve(event, {
          transformPageChunk: ({ html }) =>
            addScriptNonce(
              html.replace('<html lang="zh-CN">', `<html lang="${locale}">`),
              nonce,
            ),
        }),
    );
    const appDurationMs = Date.now() - appStartMs;
    const totalDurationMs = Date.now() - startMs;
    const shouldSetCsp = isHtmlResponse(response);
    if (!isApiRequest(event.url.pathname) && shouldSetCsp) {
      recordPageRequestFinish({
        authMode: session?.user.id ? "authenticated" : "anonymous",
        locale,
        method: event.request.method,
        requestId,
        responseBytes: contentLength(response),
        routeId: event.route.id,
        status: response.status,
        timings: {
          appDurationMs,
          authDurationMs,
          totalDurationMs,
        },
      });
    }

    const mutableResponse = responseWithSecurityHeaders(response);
    if (apiObservability) {
      recordObservedApiResponse(event.request, mutableResponse.status);
      mutableResponse.headers.set("x-request-id", apiObservability.requestId);
    } else if (shouldSetCsp) {
      mutableResponse.headers.set("x-request-id", requestId);
    }
    if (!shouldSetCsp) return mutableResponse;

    mutableResponse.headers.set("Content-Language", locale);
    appendPageServerTiming(mutableResponse.headers, {
      appDurationMs,
      authDurationMs,
      totalDurationMs,
    });
    if (!mutableResponse.headers.has("Cache-Control")) {
      mutableResponse.headers.set("Cache-Control", "no-store");
    }
    setContentSignal(mutableResponse.headers);
    mutableResponse.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy(nonce, {
        formActionSources: oauthAuthorizeFormActionSources(event.url),
        isDevelopment: getOptionalTrimmedEnv("NODE_ENV") === "development",
      }),
    );
    return mutableResponse;
  } catch (error) {
    if (apiObservability) {
      if (isRedirect(error)) {
        recordObservedApiResponse(event.request, error.status);
      } else {
        recordObservedApiError(event.request, error);
      }
    }
    throw error;
  }
};

export const handle: Handle = async (input) =>
  await runWithCloudflareRuntimeEnv(
    (input.event.platform as { env?: unknown } | undefined)?.env,
    () => handleWithRuntimeEnv(input),
    (input.event.platform as { context?: unknown; ctx?: unknown } | undefined)
      ?.ctx ??
      (input.event.platform as { context?: unknown; ctx?: unknown } | undefined)
        ?.context,
  );

function serializeServerError(error: unknown) {
  return { name: getSafeErrorName(error) };
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
