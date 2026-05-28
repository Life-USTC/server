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

export function resolveAuthRedirectTarget(
  options: AuthRedirectOptions,
  fallbackUrl = "/",
): string {
  return options.redirectTo ?? options.callbackUrl ?? fallbackUrl;
}

export function buildSignInPageUrl(callbackUrl: string) {
  return `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
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
  if (typeof params.callbackUrl === "string" && params.callbackUrl.length > 0) {
    return params.callbackUrl;
  }

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

  if (
    pathname === "/welcome" ||
    pathname === "/signin" ||
    pathname.startsWith("/oauth/") ||
    isOAuthCallbackContinuation(url)
  ) {
    return false;
  }

  return true;
}
