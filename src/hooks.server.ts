import { type Handle, type HandleServerError, redirect } from "@sveltejs/kit";
import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import { shouldRedirectIncompleteProfileToWelcome } from "@/lib/auth/auth-routing";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { setCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime-env";
import {
  recordApiRequestStart,
  setApiRequestObservabilityContext,
} from "@/lib/log/api-observability";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
} from "@/lib/security/csp";

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

function prepareApiObservability(request: Request, pathname: string) {
  if (!isApiRequest(pathname)) return null;

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const startMs = Date.now();
  setApiRequestObservabilityContext(request, { requestId, startMs });
  recordApiRequestStart({
    method: request.method,
    pathname,
    requestId,
  });
  return { requestId };
}

export const handle: Handle = async ({ event, resolve }) => {
  setCloudflareRuntimeEnv(
    (event.platform as { env?: unknown } | undefined)?.env,
  );

  const locale = negotiateLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language"),
  );
  event.locals.locale = locale;
  const apiObservability = prepareApiObservability(
    event.request,
    event.url.pathname,
  );
  const nonce = createScriptNonce();

  const session = hasRequestAuthSignal(event.request.headers)
    ? await import("@/lib/auth/core").then(({ getSessionFromHeaders }) =>
        getSessionFromHeaders(event.request.headers),
      )
    : null;
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

  if (!apiObservability && !shouldSetCsp) {
    return response;
  }

  const mutableResponse = responseWithMutableHeaders(response);
  if (apiObservability) {
    mutableResponse.headers.set("x-request-id", apiObservability.requestId);
  }
  if (shouldSetCsp) {
    mutableResponse.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy(nonce, {
        isDevelopment: process.env.NODE_ENV === "development",
      }),
    );
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
