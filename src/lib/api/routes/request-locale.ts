import { isAppLocale, LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import { jsonResponse } from "@/lib/api/helpers";
import {
  PRIVATE_LOCALE_CATALOG_HEADERS,
  PUBLIC_LOCALE_CATALOG_HEADERS,
} from "@/lib/public-cache-control";

function getCookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join("="));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function getRequestLocale(request: Request) {
  return negotiateLocale(
    getCookieValue(request, LOCALE_COOKIE),
    request.headers.get("accept-language"),
  );
}

export function resolvePublicCatalogLocale(request: Request) {
  const explicitLocale = new URL(request.url).searchParams.get("locale");

  if (explicitLocale !== null) {
    if (!isAppLocale(explicitLocale)) {
      return jsonResponse(
        { error: "Invalid locale" },
        {
          status: 400,
          headers: PRIVATE_LOCALE_CATALOG_HEADERS,
        },
      );
    }

    return {
      cacheHeaders: PUBLIC_LOCALE_CATALOG_HEADERS,
      locale: explicitLocale,
    } as const;
  }

  return {
    cacheHeaders: PRIVATE_LOCALE_CATALOG_HEADERS,
    locale: getRequestLocale(request),
  } as const;
}
