import { describe, expect, it } from "vitest";
import {
  type CampusReferenceKind,
  campusReferenceMarkdownPlugins,
  remarkCampusReferences,
} from "@/features/markdown/lib/campus-reference-markdown";
import { renderMarkdown } from "@/lib/components/markdown-preview-renderer";

describe("markdown renderer", () => {
  it("keeps campus references inert without injected feature plugins", () => {
    const html = renderMarkdown("See section#123 and teacher#456.");

    expect(html).toContain("section#123");
    expect(html).not.toContain('href="/sections/123"');
    expect(html).not.toContain('href="/teachers/456"');
  });

  it("links campus references when the feature plugin is injected", () => {
    const html = renderMarkdown("See section#123 and teacher#456.", {
      remarkPlugins: campusReferenceMarkdownPlugins,
    });

    expect(html).toContain('href="/sections/123"');
    expect(html).toContain('href="/teachers/456"');
  });

  it("allows feature callers to inject a custom campus reference resolver", () => {
    const html = renderMarkdown("See teacher#456.", {
      remarkPlugins: [
        [
          remarkCampusReferences,
          {
            resolveReference: (kind: CampusReferenceKind, id: string) =>
              `/catalog/${kind}/${id}`,
          },
        ],
      ],
    });

    expect(html).toContain('href="/catalog/teacher/456"');
  });
});
