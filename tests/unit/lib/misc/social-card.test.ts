import { describe, expect, test } from "vitest";
import {
  buildSocialCardPath,
  normalizeSocialCardOptions,
  socialCardOptionsFromSearchParams,
} from "@/lib/social-card";

describe("social card input", () => {
  test("round-trips the supported page fields through the image URL", () => {
    const path = buildSocialCardPath({
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      footer: "Life@USTC · 校园社区",
      label: "PROFILE · 公开主页",
      subtitle: "公开主页 · 校园社区",
      title: "科大喵",
      username: "life_ustc",
      variant: "profile",
    });
    const parsed = socialCardOptionsFromSearchParams(
      new URL(path, "https://life.example.edu").searchParams,
    );

    expect(parsed).toEqual({
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      footer: "Life@USTC · 校园社区",
      label: "PROFILE · 公开主页",
      subtitle: "公开主页 · 校园社区",
      title: "科大喵",
      username: "life_ustc",
      variant: "profile",
    });
  });

  test("bounds public query text and falls back from unknown variants", () => {
    const parsed = normalizeSocialCardOptions({
      subtitle: "副".repeat(200),
      title: "题".repeat(100),
      variant: "unknown" as never,
    });

    expect(Array.from(parsed.title)).toHaveLength(72);
    expect(Array.from(parsed.subtitle)).toHaveLength(120);
    expect(parsed.variant).toBe("default");
  });
});
