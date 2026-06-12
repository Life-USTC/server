import * as z from "zod";

export const APP_LOCALES = ["en-us", "zh-cn"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-cn";
export const LOCALE_COOKIE = "NEXT_LOCALE";

const localeSet = new Set<string>(APP_LOCALES);

export function isAppLocale(value: string): value is AppLocale {
  return localeSet.has(value);
}

export const localeSchema = z.enum(APP_LOCALES);

/**
 * Resolves locale from cookie, then Accept-Language, then default.
 */
export function negotiateLocale(
  cookieLocale: string | undefined,
  acceptLanguage: string | null,
): AppLocale {
  if (cookieLocale && isAppLocale(cookieLocale)) {
    return cookieLocale;
  }

  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [loc, q] = lang.trim().split(";q=");
        return {
          locale: loc.toLowerCase(),
          quality: q ? Number.parseFloat(q) : 1.0,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    const supported = APP_LOCALES as readonly string[];

    for (const { locale } of languages) {
      if (supported.includes(locale)) {
        return locale as AppLocale;
      }
      const prefix = locale.split("-")[0];
      const matched = supported.find((l) => l.startsWith(prefix));
      if (matched) {
        return matched as AppLocale;
      }
    }
  }

  return DEFAULT_LOCALE;
}
