import rehypeAttr from "rehype-attr";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type PluggableList, unified } from "unified";
import {
  rehypeNormalizeMarkdownElements,
  remarkCalloutDirectives,
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

function createProcessor(options: { remarkPlugins?: PluggableList } = {}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkEmoji)
    .use(remarkCalloutDirectives)
    .use(remarkImageAttributes)
    .use(remarkInlineExtensions);

  if (options.remarkPlugins?.length) {
    processor.use({ plugins: options.remarkPlugins });
  }

  return processor
    .use(remarkRehype)
    .use(rehypeAttr, {})
    .use(rehypeSanitize, markdownSanitizeSchema)
    .use(rehypeKatex)
    .use(rehypeNormalizeMarkdownElements)
    .use(rehypeStringify);
}

const defaultProcessor = createProcessor();

export function renderMarkdown(
  value: string,
  options: { remarkPlugins?: PluggableList } = {},
) {
  try {
    const processor = options.remarkPlugins?.length
      ? createProcessor(options)
      : defaultProcessor;
    return String(processor.processSync(normalizeMarkdownInput(value)));
  } catch {
    return "";
  }
}
