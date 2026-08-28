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
  remarkShiftHeadings,
} from "./markdown-preview-plugins";
import {
  markdownSanitizeSchema,
  rehypeSanitize,
} from "./markdown-preview-sanitize";

function normalizeMarkdownInput(value: string) {
  return value.replace(/^::::/gm, ":::");
}

type MarkdownRenderOptions = {
  headingOffset?: number;
  remarkPlugins?: PluggableList;
};

function createProcessor(options: MarkdownRenderOptions = {}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkEmoji)
    .use(remarkCalloutDirectives)
    .use(remarkImageAttributes)
    .use(remarkInlineExtensions)
    .use(remarkShiftHeadings, { offset: options.headingOffset ?? 0 });

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
  options: MarkdownRenderOptions = {},
) {
  try {
    const processor =
      options.remarkPlugins?.length || options.headingOffset
        ? createProcessor(options)
        : defaultProcessor;
    return String(processor.processSync(normalizeMarkdownInput(value)));
  } catch {
    return "";
  }
}

export function renderEmbeddedMarkdown(
  value: string,
  options: Omit<MarkdownRenderOptions, "headingOffset"> = {},
) {
  return renderMarkdown(value, { ...options, headingOffset: 2 });
}
