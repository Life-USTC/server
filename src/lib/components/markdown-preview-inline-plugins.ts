import type { Root as MdastRoot, Text } from "mdast";
import { visit } from "unist-util-visit";
import type {
  InlineExtensionNode,
  MarkdownChild,
  MutableMarkdownParent,
} from "./markdown-preview-types";

function inlineExtensionNode(tagName: string, value: string) {
  return {
    type: "inlineExtension",
    data: { hName: tagName },
    children: [{ type: "text", value }],
  } satisfies InlineExtensionNode;
}

function replaceTextWithInlineTokens(
  value: string,
  pattern: RegExp,
  tokenToNode: (token: string) => MarkdownChild,
) {
  const children: MarkdownChild[] = [];
  let cursor = 0;
  let match = pattern.exec(value);

  while (match !== null) {
    if (match.index > cursor) {
      children.push({
        type: "text",
        value: value.slice(cursor, match.index),
      });
    }
    children.push(tokenToNode(match[0]));
    cursor = pattern.lastIndex;
    match = pattern.exec(value);
  }

  if (children.length === 0) return null;
  if (cursor < value.length) {
    children.push({ type: "text", value: value.slice(cursor) });
  }
  return children;
}

export function remarkInlineExtensions() {
  return (tree: unknown) => {
    visit(tree as MdastRoot, "text", (node: Text, index, parent) => {
      const mutableParent = parent as MutableMarkdownParent | undefined;
      if (index === undefined || !parent || parent.type === "link") return;
      const value = String(node.value ?? "");
      const children = replaceTextWithInlineTokens(
        value,
        /(\+\+[^+\n]+\+\+|==[^=\n]+==|~[^~\n]+~|\^[^^\n]+\^)/g,
        (token) => {
          if (token.startsWith("++")) {
            return inlineExtensionNode("ins", token.slice(2, -2));
          }
          if (token.startsWith("==")) {
            return inlineExtensionNode("mark", token.slice(2, -2));
          }
          if (token.startsWith("~")) {
            return inlineExtensionNode("sub", token.slice(1, -1));
          }
          return inlineExtensionNode("sup", token.slice(1, -1));
        },
      );
      if (!children) return;
      mutableParent?.children.splice(index, 1, ...children);
    });
  };
}

export function remarkCampusReferences() {
  return (tree: unknown) => {
    visit(tree as MdastRoot, "text", (node: Text, index, parent) => {
      const mutableParent = parent as MutableMarkdownParent | undefined;
      if (index === undefined || !parent || parent.type === "link") return;
      const value = String(node.value ?? "");
      const children = replaceTextWithInlineTokens(
        value,
        /\b(section|teacher)#(\d+)\b/gi,
        (token) => {
          const [, rawKind, id] =
            /\b(section|teacher)#(\d+)\b/i.exec(token) ?? [];
          const kind = String(rawKind).toLowerCase();
          return {
            type: "link",
            url: kind === "teacher" ? `/teachers/${id}` : `/sections/${id}`,
            children: [{ type: "text", value: token }],
          };
        },
      );
      if (!children) return;
      mutableParent?.children.splice(index, 1, ...children);
    });
  };
}
