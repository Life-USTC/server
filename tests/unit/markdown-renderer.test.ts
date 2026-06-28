import { describe, expect, it } from "vitest";
import {
  type CampusReferenceKind,
  campusReferenceMarkdownPlugins,
  remarkCampusReferences,
} from "@/features/markdown/lib/campus-reference-markdown";
import { renderMarkdown } from "@/lib/components/markdown-preview-renderer";

describe("markdown 渲染器", () => {
  it("未注入特性插件时 campus 引用保持原样", () => {
    const html = renderMarkdown("See section#123 and teacher#456.");

    expect(html).toContain("section#123");
    expect(html).not.toContain('href="/sections/123"');
    expect(html).not.toContain('href="/teachers/456"');
  });

  it("注入特性插件时将 campus 引用转为链接", () => {
    const html = renderMarkdown("See section#123 and teacher#456.", {
      remarkPlugins: campusReferenceMarkdownPlugins,
    });

    expect(html).toContain('href="/sections/123"');
    expect(html).toContain('href="/teachers/456"');
  });

  it("允许特性调用者注入自定义 campus 引用解析器", () => {
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
