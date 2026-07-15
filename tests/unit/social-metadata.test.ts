import { describe, expect, test } from "vitest";
import {
  buildSocialMetadata,
  formatSocialMetadataMessage,
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_PATH,
  SOCIAL_CARD_WIDTH,
} from "@/lib/social-metadata";

describe("buildSocialMetadata", () => {
  test("builds one same-origin large-image card for Chinese pages", () => {
    const metadata = buildSocialMetadata({
      canonicalPath: "/courses/9901001/introduction?utm_source=test#details",
      description: "课程简介",
      imageAlt: "分享卡片",
      locale: "zh-cn",
      origin: "https://life.example.edu",
      title: "数值分析 (001046) - Life@USTC",
    });

    expect(metadata).toEqual({
      alternateLocale: "en_US",
      canonicalUrl: "https://life.example.edu/courses/9901001/introduction",
      description: "课程简介",
      image: {
        alt: "分享卡片",
        height: SOCIAL_CARD_HEIGHT,
        type: "image/png",
        url: `https://life.example.edu${SOCIAL_CARD_PATH}`,
        width: SOCIAL_CARD_WIDTH,
      },
      locale: "zh_CN",
      siteName: "Life@USTC",
      title: "数值分析 (001046) - Life@USTC",
      twitterCard: "summary_large_image",
      type: "website",
    });
  });

  test("keeps canonical paths on the configured origin", () => {
    const metadata = buildSocialMetadata({
      canonicalPath: "https://attacker.example/teachers/42?preview=1",
      description: "Teacher profile",
      imageAlt: "Social card",
      locale: "en-us",
      origin: "https://life.example.edu/ignored?query=1#hash",
      title: "Teacher: Ada - Life@USTC",
    });

    expect(metadata.canonicalUrl).toBe("https://life.example.edu/teachers/42");
    expect(metadata.locale).toBe("en_US");
    expect(metadata.alternateLocale).toBe("zh_CN");
  });
});

describe("formatSocialMetadataMessage", () => {
  test("replaces every occurrence without interpreting special characters", () => {
    expect(
      formatSocialMetadataMessage("{name} / {name} ({code})", {
        code: "$&.01",
        name: "A&B <Course>",
      }),
    ).toBe("A&B <Course> / A&B <Course> ($&.01)");
  });
});
