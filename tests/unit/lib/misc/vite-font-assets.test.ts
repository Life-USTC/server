import { describe, expect, test } from "vitest";
import {
  assetInlineDecision,
  keepModernKatexFontSources,
} from "../../../../vite.config";

describe("Vite font asset handling", () => {
  test.each(["woff", "woff2", "ttf", "otf", "eot"])(
    "keeps .%s fonts as same-origin files",
    (extension) => {
      expect(
        assetInlineDecision(
          `/node_modules/katex/fonts/KaTeX_Size3.${extension}`,
        ),
      ).toBe(false);
    },
  );

  test("leaves non-font assets on Vite's default threshold", () => {
    expect(assetInlineDecision("/src/images/icon.svg")).toBeUndefined();
  });

  test("keeps only the modern KaTeX woff2 source", () => {
    const css =
      '@font-face{src:url(font.woff2) format("woff2"),url(font.woff) format("woff"),url(font.ttf) format("truetype")}';

    expect(keepModernKatexFontSources(css)).toBe(
      '@font-face{src:url(font.woff2) format("woff2")}',
    );
  });
});
