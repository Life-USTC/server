import type { AppLocale } from "@/i18n/config";

export const SOCIAL_CARD_PATH = "/images/social-card.png";
export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;

const openGraphLocales = {
  "en-us": "en_US",
  "zh-cn": "zh_CN",
} as const satisfies Record<AppLocale, string>;

export type SocialMetadata = {
  alternateLocale: string;
  canonicalUrl: string;
  description: string;
  image: {
    alt: string;
    height: number;
    type: "image/png";
    url: string;
    width: number;
  };
  locale: string;
  siteName: "Life@USTC";
  title: string;
  twitterCard: "summary_large_image";
  type: "website";
};

export function buildSocialMetadata({
  canonicalPath,
  description,
  imageAlt,
  locale,
  origin,
  title,
}: {
  canonicalPath: string;
  description: string;
  imageAlt: string;
  locale: AppLocale;
  origin: string;
  title: string;
}): SocialMetadata {
  const canonicalUrl = new URL(origin);
  const canonicalPathUrl = new URL(canonicalPath, canonicalUrl.origin);
  canonicalUrl.pathname = canonicalPathUrl.pathname;
  canonicalUrl.search = "";
  canonicalUrl.hash = "";

  const alternateLocale = locale === "zh-cn" ? "en-us" : "zh-cn";

  return {
    alternateLocale: openGraphLocales[alternateLocale],
    canonicalUrl: canonicalUrl.href,
    description,
    image: {
      alt: imageAlt,
      height: SOCIAL_CARD_HEIGHT,
      type: "image/png",
      url: new URL(SOCIAL_CARD_PATH, canonicalUrl.origin).href,
      width: SOCIAL_CARD_WIDTH,
    },
    locale: openGraphLocales[locale],
    siteName: "Life@USTC",
    title,
    twitterCard: "summary_large_image",
    type: "website",
  };
}

export function formatSocialMetadataMessage(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template,
  );
}
