import type { Element, Root as HastRoot } from "hast";
import type { Image, Root as MdastRoot, Paragraph, Text } from "mdast";
import { visit } from "unist-util-visit";

function parseAttrs(value: string) {
  const attrs: Record<string, string> = {};
  for (const attr of value.split(/\s+/)) {
    const [key, raw] = attr.split("=");
    if (!key || !raw) continue;
    attrs[key] = raw.replace(/^["']|["']$/g, "");
  }
  return attrs;
}

export function remarkImageAttributes() {
  return (tree: unknown) => {
    visit(tree as MdastRoot, "paragraph", (node: Paragraph) => {
      if (!Array.isArray(node.children)) return;
      for (let index = 0; index < node.children.length - 1; index += 1) {
        const image = node.children[index] as Image | undefined;
        const text = node.children[index + 1] as Text | undefined;
        if (image?.type !== "image" || text?.type !== "text") continue;
        const match = String(text.value ?? "").match(/^\{([^}]+)\}/);
        if (!match) continue;

        image.data = {
          ...image.data,
          hProperties: {
            ...(image.data?.hProperties ?? {}),
            ...parseAttrs(match[1] ?? ""),
          },
        };
        text.value = String(text.value ?? "").slice(match[0].length);
        if (!text.value) node.children.splice(index + 1, 1);
      }
    });
  };
}

export function rehypeNormalizeMarkdownElements() {
  return (tree: unknown) => {
    visit(tree as HastRoot, "element", (node: Element) => {
      if (node.tagName === "a") {
        const href = String(node.properties?.href ?? "");
        if (/^https?:\/\//i.test(href)) {
          node.properties = {
            ...node.properties,
            rel: "noreferrer",
            target: "_blank",
          };
        }
      }

      if (node.tagName === "img") {
        const align = String(node.properties?.align ?? "");
        const className = Array.isArray(node.properties?.className)
          ? node.properties.className
          : [];
        if (align === "center") className.push("markdown-image-center");
        if (align === "right") className.push("markdown-image-right");
        node.properties = {
          ...node.properties,
          className,
        };
      }
    });
  };
}
