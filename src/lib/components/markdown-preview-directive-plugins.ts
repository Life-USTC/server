import type { Root as MdastRoot } from "mdast";
import type { Transformer } from "unified";
import { visit } from "unist-util-visit";
import type { DirectiveNode } from "./markdown-preview-types";

function isDirectiveNode(node: unknown): node is DirectiveNode {
  const type =
    typeof node === "object" && node !== null
      ? (node as { type?: unknown }).type
      : undefined;
  return (
    type === "containerDirective" ||
    type === "leafDirective" ||
    type === "textDirective"
  );
}

function directiveClass(name: string) {
  if (name === "center") return "markdown-directive markdown-directive-center";
  if (name === "tip") return "markdown-directive markdown-directive-tip";
  if (name === "warning")
    return "markdown-directive markdown-directive-warning";
  if (name === "error") return "markdown-directive markdown-directive-error";
  return "markdown-directive";
}

export function remarkCalloutDirectives(): Transformer<MdastRoot> {
  return (tree, file) => {
    const source = String(file);
    visit(tree, (node, index, parent) => {
      if (!isDirectiveNode(node)) return;

      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (
        node.type === "textDirective" &&
        typeof start === "number" &&
        typeof end === "number" &&
        source.slice(start, end) === `:${node.name}` &&
        parent &&
        typeof index === "number"
      ) {
        parent.children[index] = {
          type: "text",
          value: source.slice(start, end),
          position: node.position,
        };
        return;
      }

      const tagName = node.type === "textDirective" ? "span" : "div";
      node.data = {
        ...node.data,
        hName: tagName,
        hProperties: {
          ...(node.attributes ?? {}),
          className: directiveClass(String(node.name ?? "note")).split(" "),
        },
      };
    });
  };
}
