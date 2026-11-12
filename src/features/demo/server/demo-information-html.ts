import type { Root } from "hast";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { isDemoInformationDestination } from "../lib/demo-information-paths";

/** Preserve the real legal text; only retire unavailable link actions before SSR. */
export function prepareDemoInformationHtml(
  html: string,
  reason: string,
  origin: string,
) {
  if (!reason) return html;
  return String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(() => (tree: Root) => {
        visit(tree, "element", (node) => {
          if (node.tagName !== "a" || typeof node.properties.href !== "string")
            return;
          try {
            if (
              isDemoInformationDestination(
                new URL(node.properties.href, origin),
                origin,
              )
            )
              return;
          } catch {
            /* Invalid destinations are unavailable too. */
          }
          delete node.properties.href;
          node.properties.ariaDisabled = "true";
          node.properties["aria-description"] = reason;
          node.properties.title = reason;
          node.properties.tabIndex = -1;
        });
      })
      .use(rehypeStringify)
      .processSync(html),
  );
}
