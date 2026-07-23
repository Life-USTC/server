import { buildSearchParams } from "@/lib/navigation/search-params";

type SignInSearchParams = {
  callbackUrl?: string;
  error?: string;
  [key: string]: string | undefined;
};

type AuthRedirectOptions = {
  redirectTo?: string;
  callbackUrl?: string;
};

const AUTH_CALLBACK_ORIGIN = "https://life-ustc.local";

function hasUnsafeCallbackCharacter(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127 || character === "\\") return true;
  }
  return false;
}

function parseAppRelativeCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (/^\/%(?:2f|5c)/i.test(candidate)) return null;
  if (hasUnsafeCallbackCharacter(candidate)) return null;

  try {
    const parsed = new URL(candidate, AUTH_CALLBACK_ORIGIN);
    if (parsed.origin !== AUTH_CALLBACK_ORIGIN) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function sanitizeAuthCallbackUrl(value: unknown, fallbackUrl = "/") {
  return (
    parseAppRelativeCallbackUrl(value) ??
    parseAppRelativeCallbackUrl(fallbackUrl) ??
    "/"
  );
}

export function resolveAuthRedirectTarget(
  options: AuthRedirectOptions,
  fallbackUrl = "/",
): string {
  return (
    parseAppRelativeCallbackUrl(options.redirectTo) ??
    parseAppRelativeCallbackUrl(options.callbackUrl) ??
    sanitizeAuthCallbackUrl(fallbackUrl)
  );
}

export function buildSignInPageUrl(callbackUrl: string) {
  return `/account/sign-in?callbackUrl=${encodeURIComponent(sanitizeAuthCallbackUrl(callbackUrl))}`;
}

export function buildCurrentPathCallbackUrl(
  pathname: string,
  searchParams?: { toString(): string } | null,
) {
  const queryString = searchParams?.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildSignInRedirectUrl(
  options: AuthRedirectOptions = {},
  fallbackUrl = "/",
) {
  return buildSignInPageUrl(resolveAuthRedirectTarget(options, fallbackUrl));
}

export function resolveSignInCallbackUrl(params: SignInSearchParams): string {
  const explicitCallbackUrl = parseAppRelativeCallbackUrl(params.callbackUrl);
  if (explicitCallbackUrl) return explicitCallbackUrl;

  const {
    callbackUrl: _callbackUrl,
    error: _error,
    ...continuationParams
  } = params;
  const authorizeQuery = new URLSearchParams(
    buildSearchParams({ values: continuationParams }),
  );

  if (!authorizeQuery.has("client_id") || !authorizeQuery.has("redirect_uri")) {
    return "/";
  }

  return `/oauth/authorize?${authorizeQuery.toString()}`;
}

function isOAuthCallbackContinuation(url: URL): boolean {
  const hasState = url.searchParams.has("state");
  const hasResult =
    url.searchParams.has("code") || url.searchParams.has("error");
  return hasState && hasResult;
}

function isNonPageRequestPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/_app/") ||
    pathname === "/llms.txt" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export function shouldRedirectIncompleteProfileToWelcome({
  pathname,
  url,
  hasUser,
  hasCompleteProfile,
}: {
  pathname: string;
  url: URL;
  hasUser: boolean;
  hasCompleteProfile: boolean;
}) {
  if (!hasUser || hasCompleteProfile) {
    return false;
  }

  if (isNonPageRequestPath(pathname)) {
    return false;
  }

  if (
    pathname === "/account/welcome" ||
    pathname === "/account/sign-in" ||
    pathname === "/account/sign-out" ||
    pathname.startsWith("/oauth/") ||
    isOAuthCallbackContinuation(url)
  ) {
    return false;
  }

  return true;
}
