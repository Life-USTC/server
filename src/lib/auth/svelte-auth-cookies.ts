import type { Cookies } from "@sveltejs/kit";

type CookieAttributes = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

function splitSetCookieHeader(value: string | null): string[] {
  if (!value) return [];
  return value.split(/,\s*(?=[^=;,]+=[^;,]+)/);
}

function getSetCookieValues(headers: Headers) {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  return typeof withGetter.getSetCookie === "function"
    ? withGetter.getSetCookie()
    : splitSetCookieHeader(headers.get("set-cookie"));
}

function parseSetCookie(value: string) {
  const [nameValue, ...parts] = value.split(";");
  const separatorIndex = nameValue.indexOf("=");
  if (separatorIndex <= 0) return null;
  const name = nameValue.slice(0, separatorIndex).trim();
  const rawCookieValue = nameValue.slice(separatorIndex + 1);
  let cookieValue: string;
  try {
    cookieValue = decodeURIComponent(rawCookieValue);
  } catch {
    cookieValue = rawCookieValue;
  }
  const attributes: CookieAttributes = {};

  for (const rawPart of parts) {
    const [rawKey, ...rawValueParts] = rawPart.trim().split("=");
    const key = rawKey.toLowerCase();
    const attrValue = rawValueParts.join("=");
    if (key === "path") attributes.path = attrValue || "/";
    if (key === "domain") attributes.domain = attrValue;
    if (key === "max-age") attributes.maxAge = Number(attrValue);
    if (key === "expires") attributes.expires = new Date(attrValue);
    if (key === "httponly") attributes.httpOnly = true;
    if (key === "secure") attributes.secure = true;
    if (key === "samesite") {
      const sameSite = attrValue.toLowerCase();
      if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
        attributes.sameSite = sameSite;
      }
    }
  }

  return { name, value: cookieValue, attributes };
}

export function applyAuthResponseCookies(headers: Headers, cookies: Cookies) {
  for (const cookieHeader of getSetCookieValues(headers)) {
    const parsed = parseSetCookie(cookieHeader);
    if (!parsed) continue;
    cookies.set(parsed.name, parsed.value, {
      path: parsed.attributes.path ?? "/",
      domain: parsed.attributes.domain,
      maxAge: parsed.attributes.maxAge,
      expires: parsed.attributes.expires,
      httpOnly: parsed.attributes.httpOnly,
      secure: parsed.attributes.secure,
      sameSite: parsed.attributes.sameSite,
    });
  }
}
