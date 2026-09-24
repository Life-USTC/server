import type { Element, Root } from "hast";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { PublicPublicationImage } from "../server/publication-public-read-service";

/** Add plain-text revision metadata after the shared Markdown sanitizer. */
export function annotatePublicationImages(
  html: string,
  images: PublicPublicationImage[],
): string {
  if (!html || images.length === 0) return html;
  const byUrl = new Map(images.map((image) => [image.url, image]));
  return String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(() => (tree: Root) => {
        visit(tree, "element", (node: Element, index, parent) => {
          if (node.tagName === "img") {
            const metadata = byUrl.get(String(node.properties.src ?? ""));
            if (!metadata) return;
            if (metadata.altText) node.properties.alt = metadata.altText;
            if (metadata.title) node.properties.title = metadata.title;
          }
          if (node.tagName !== "p") return;
          const content = node.children.filter(
            (child) => child.type !== "text" || child.value.trim() !== "",
          );
          if (
            content.length !== 1 ||
            content[0].type !== "element" ||
            content[0].tagName !== "img"
          )
            return;
          const metadata = byUrl.get(String(content[0].properties.src ?? ""));
          if (!metadata?.caption) return;
          const next = parent?.children
            .slice((index ?? 0) + 1)
            .find(
              (child) => child.type !== "text" || child.value.trim() !== "",
            );
          if (next?.type === "element") {
            let nextText = "";
            visit(next, "text", (text) => {
              nextText += text.value;
            });
            if (nextText.trim() === metadata.caption.trim()) return;
          }
          node.tagName = "figure";
          node.children.push({
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: [{ type: "text", value: metadata.caption }],
          });
        });
      })
      .use(rehypeStringify)
      .processSync(html),
  );
}
