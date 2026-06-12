import type { Cookies } from "@sveltejs/kit";

export type AuthActionInput = {
  providerId: string;
  callbackUrl: string;
  headers: Headers;
  cookies: Cookies;
};

export type AuthActionResponse = {
  headers: Headers;
  result: unknown;
};

export type SignInResult = {
  url: string;
};

export type GenericOAuthWithHeaders = {
  signInWithOAuth2(input: {
    body: { providerId: string; callbackURL: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
  oAuth2LinkAccount(input: {
    body: { providerId: string; callbackURL: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
};

export type SocialLinkWithHeaders = {
  linkSocialAccount(input: {
    body: {
      callbackURL: string;
      disableRedirect: true;
      provider: string;
    };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
};

export function extractResultUrl(result: unknown, fallback: string) {
  if (result && typeof result === "object") {
    const value = (result as { url?: unknown }).url;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return fallback;
}
