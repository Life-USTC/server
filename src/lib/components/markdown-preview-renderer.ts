import rehypeAttr from "rehype-attr";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  rehypeNormalizeMarkdownElements,
  remarkCalloutDirectives,
  remarkCampusReferences,
  remarkImageAttributes,
  remarkInlineExtensions,
} from "./markdown-preview-plugins";
import {
  markdownSanitizeSchema,
  rehypeSanitize,
} from "./markdown-preview-sanitize";

function normalizeMarkdownInput(value: string) {
  return value.replace(/^::::/gm, ":::");
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkEmoji)
  .use(remarkCalloutDirectives)
  .use(remarkImageAttributes)
  .use(remarkInlineExtensions)
  .use(remarkCampusReferences)
  .use(remarkRehype)
  .use(rehypeAttr, {})
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(rehypeKatex)
  .use(rehypeNormalizeMarkdownElements)
  .use(rehypeStringify);

export function renderMarkdown(value: string) {
  try {
    return String(processor.processSync(normalizeMarkdownInput(value)));
  } catch {
    return "";
  }
}
