import { describe, expect, test } from "vitest";
import {
  buildSocialMetadata,
  updateSocialMetadata,
} from "@/lib/social-metadata";

const origin = "https://life.example.edu";

describe("social metadata policy acceptance", () => {
  test("ui.social-sharing-metadata-2", () => {
    for (const canonicalPath of [
      "/catalog/courses/123?utm_source=example#description",
      "https://attacker.example/catalog/sections/456?credential=secret#details",
      "/account/settings/profile?code=secret&state=private",
    ]) {
      const metadata = buildSocialMetadata({
        canonicalPath,
        description: "Page description",
        imageAlt: "Life@USTC social card",
        locale: "en-us",
        origin,
        title: "Life@USTC",
      });
      const canonical = new URL(metadata.canonicalUrl);
      expect(canonical.origin).toBe(origin);
      expect(canonical.search).toBe("");
      expect(canonical.hash).toBe("");
      expect(canonical.username).toBe("");
      expect(canonical.password).toBe("");
      expect(metadata.canonicalUrl).not.toContain("secret");
    }
  });

  test("ui.social-sharing-metadata-4", () => {
    for (const locale of ["zh-cn", "en-us"] as const) {
      const imageAlt =
        locale === "zh-cn" ? "Life@USTC 分享卡片" : "Life@USTC social card";
      const metadata = buildSocialMetadata({
        canonicalPath: "/catalog/courses/123",
        description: "Page description",
        imageAlt,
        locale,
        origin,
        title: "Life@USTC",
      });
      expect(metadata.image).toEqual({
        alt: imageAlt,
        height: 630,
        type: "image/png",
        url: `${origin}/open-graph.png`,
        width: 1200,
      });
    }
  });

  test("ui.social-sharing-metadata-5", () => {
    for (const locale of ["zh-cn", "en-us"] as const) {
      for (const canonicalPath of [
        "/",
        "/catalog/courses/123",
        "/account/settings/profile",
      ]) {
        const metadata = buildSocialMetadata({
          canonicalPath,
          description: "Page description",
          imageAlt: "Social card",
          locale,
          origin,
          title: "Private profile title",
        });
        const updated = updateSocialMetadata(metadata, {
          description: "Changed page description",
          title: "A different page title",
        });
        expect(updated.image.url).toBe(`${origin}/open-graph.png`);
        expect(updated.image).toEqual(metadata.image);
      }
    }
  });
});
