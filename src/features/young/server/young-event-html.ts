import type { Root } from "hast";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import {
  markdownSanitizeSchema,
  rehypeSanitize,
} from "@/lib/components/markdown-preview-sanitize";
import { normalizeYoungEventImagePath } from "./young-event-image-service";

const YOUNG_IMAGE_ORIGIN = "https://young.ustc.edu.cn/login/";
const LOCAL_IMAGE_PREFIX = "/api/catalog/young-events/images/";

/**
 * Decide what an upstream `<img src>` should become.
 *
 * - `undefined` leaves the attribute untouched (foreign hosts, data URIs).
 * - `null` drops the attribute (a young path that fails normalization, so we
 *   would otherwise emit a proxy URL the route is going to reject anyway).
 * - a string replaces the attribute with our own cached proxy path.
 */
function rewriteImageSrc(src: unknown): string | null | undefined {
  if (typeof src !== "string") return undefined;
  const trimmed = src.trim();
  if (trimmed === "") return undefined;

  let rawPath: string;
  if (trimmed.startsWith(YOUNG_IMAGE_ORIGIN)) {
    rawPath = trimmed.slice(YOUNG_IMAGE_ORIGIN.length);
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    // Any other absolute URL (including data: and protocol-relative) belongs to
    // someone else; sanitization still decides whether it survives.
    return undefined;
  } else if (/^\/?group\d+\//.test(trimmed)) {
    rawPath = trimmed.replace(/^\//, "");
  } else {
    return undefined;
  }

  const normalized = normalizeYoungEventImagePath(rawPath);
  return normalized == null ? null : `${LOCAL_IMAGE_PREFIX}${normalized}`;
}

function rewriteYoungImages() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "img") return;
      const properties = node.properties ?? {};
      const rewritten = rewriteImageSrc(properties.src);
      if (rewritten === undefined) return;
      if (rewritten === null) {
        node.properties = { ...properties, src: undefined };
        return;
      }
      node.properties = { ...properties, src: rewritten };
    });
  };
}

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rewriteYoungImages)
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(rehypeStringify)
  .freeze();

/**
 * Sanitize an upstream young.ustc.edu.cn rich-text field and point its images
 * at our own cached proxy.
 *
 * The database keeps the upstream HTML verbatim; every interface (REST,
 * GraphQL, MCP, Web) runs it through here at serialization time so the
 * whitelist and the image rewriting can never drift apart.
 */
export function renderYoungEventHtml(html: string): string {
  return String(processor.processSync(html));
}
