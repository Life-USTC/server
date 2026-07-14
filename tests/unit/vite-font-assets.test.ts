import { describe, expect, test } from "vitest";
import { assetInlineDecision } from "../../vite.config";

describe("Vite font asset handling", () => {
  test.each([
    "woff",
    "woff2",
    "ttf",
    "otf",
    "eot",
  ])("keeps .%s fonts as same-origin files", (extension) => {
    expect(
      assetInlineDecision(`/node_modules/katex/fonts/KaTeX_Size3.${extension}`),
    ).toBe(false);
  });

  test("leaves non-font assets on Vite's default threshold", () => {
    expect(assetInlineDecision("/src/images/icon.svg")).toBeUndefined();
  });
});
