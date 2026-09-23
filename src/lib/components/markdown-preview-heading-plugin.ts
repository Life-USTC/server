import type { Heading, Root } from "mdast";
import { visit } from "unist-util-visit";

export function remarkShiftHeadings({ offset }: { offset: number }) {
  return (tree: Root) => {
    visit(tree, "heading", (node: Heading) => {
      node.depth = Math.min(6, node.depth + offset) as Heading["depth"];
    });
  };
}
