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

const noRemarkPlugins: PluggableList = [];

// Building the 15-plugin chain costs more than running it, and the server
// renders one comment body per thread node. A `unified` processor freezes on
// first use and none of the plugins above keep per-run state, so one processor
// per distinct options shape is reused across `processSync` calls. Keyed
// weakly on the plugin list so caller-owned arrays stay collectable.
const processorsByRemarkPlugins = new WeakMap<
  PluggableList,
  Map<number, ReturnType<typeof createProcessor>>
>();

function getProcessor(options: MarkdownRenderOptions) {
  const remarkPlugins = options.remarkPlugins?.length
    ? options.remarkPlugins
    : noRemarkPlugins;
  const headingOffset = options.headingOffset ?? 0;

  let byHeadingOffset = processorsByRemarkPlugins.get(remarkPlugins);
  if (!byHeadingOffset) {
    byHeadingOffset = new Map();
    processorsByRemarkPlugins.set(remarkPlugins, byHeadingOffset);
  }

  let processor = byHeadingOffset.get(headingOffset);
  if (!processor) {
    processor = createProcessor({ headingOffset, remarkPlugins });
    byHeadingOffset.set(headingOffset, processor);
  }
  return processor;
}

export function renderMarkdown(
  value: string,
  options: MarkdownRenderOptions = {},
) {
  try {
    return String(
      getProcessor(options).processSync(normalizeMarkdownInput(value)),
    );
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
