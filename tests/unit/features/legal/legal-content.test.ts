import { describe, expect, it } from "vitest";
import {
  getLegalContent,
  getLegalPageContent,
} from "@/features/legal/server/legal-content";

describe("legal content", () => {
  it.each(["privacy", "terms"] as const)(
    "builds MDX with a heading per section for %s in both locales",
    (key) => {
      for (const locale of ["zh-cn", "en-us"] as const) {
        const content = getLegalContent(locale, key);
        expect(content.mdx.startsWith(`# ${content.title}`)).toBe(true);
        for (const section of content.sections) {
          expect(content.mdx).toContain(`## ${section.title}`);
          for (const item of section.items) {
            expect(content.mdx).toContain(`- ${item}`);
          }
        }
      }
    },
  );

  it("renders HTML for the page payload", () => {
    const page = getLegalPageContent("en-us", "privacy");
    expect(page.renderedHtml).toContain("<h1");
    expect(page.mdx).toBe(getLegalContent("en-us", "privacy").mdx);
  });
});
