import type { AppLocale } from "@/i18n/config";
import {
  buildSocialCardUrl,
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_WIDTH,
  type SocialCardOptions,
  socialCardTitle,
} from "@/lib/social-card";

export { SOCIAL_CARD_HEIGHT, SOCIAL_CARD_WIDTH } from "@/lib/social-card";

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
  card,
  canonicalPath,
  description,
  imageAlt,
  locale,
  origin,
  title,
}: {
  card?: Partial<SocialCardOptions>;
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
      url: buildSocialCardUrl(canonicalUrl.origin, {
        subtitle: description,
        title: socialCardTitle(title),
        ...card,
      }),
      width: SOCIAL_CARD_WIDTH,
    },
    locale: openGraphLocales[locale],
    siteName: "Life@USTC",
    title,
    twitterCard: "summary_large_image",
    type: "website",
  };
}

export function updateSocialMetadata(
  metadata: SocialMetadata,
  changes: {
    card?: Partial<SocialCardOptions>;
    description?: string;
    title?: string;
  },
): SocialMetadata {
  const description = changes.description ?? metadata.description;
  const title = changes.title ?? metadata.title;
  const origin = new URL(metadata.canonicalUrl).origin;

  return {
    ...metadata,
    description,
    image: {
      ...metadata.image,
      url: buildSocialCardUrl(origin, {
        subtitle: description,
        title: socialCardTitle(title),
        ...changes.card,
      }),
    },
    title,
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
