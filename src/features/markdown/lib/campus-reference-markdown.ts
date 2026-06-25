import type { Link, PhrasingContent, Root, Text } from "mdast";
import type { PluggableList, Plugin } from "unified";
import { visit } from "unist-util-visit";

export type CampusReferenceKind = "section" | "teacher";

export type CampusReferenceResolver = (
  kind: CampusReferenceKind,
  id: string,
  token: string,
) => string | null | undefined;

type MutableTextParent = {
  type?: string;
  children: PhrasingContent[];
};

function defaultCampusReferenceHref(kind: CampusReferenceKind, id: string) {
  return kind === "teacher" ? `/teachers/${id}` : `/sections/${id}`;
}

function campusReferenceLink(
  token: string,
  resolveReference: CampusReferenceResolver,
): Link | Text {
  const [, rawKind, id] = /\b(section|teacher)#(\d+)\b/i.exec(token) ?? [];
  const kind = String(rawKind).toLowerCase() as CampusReferenceKind;
  const href = resolveReference(kind, String(id), token);

  if (!href) return { type: "text", value: token };

  return {
    type: "link",
    url: href,
    children: [{ type: "text", value: token }],
  };
}

function replaceCampusReferences(
  value: string,
  resolveReference: CampusReferenceResolver,
) {
  const pattern = /\b(section|teacher)#(\d+)\b/gi;
  const children: PhrasingContent[] = [];
  let cursor = 0;
  let match = pattern.exec(value);

  while (match !== null) {
    if (match.index > cursor) {
      children.push({ type: "text", value: value.slice(cursor, match.index) });
    }
    children.push(campusReferenceLink(match[0], resolveReference));
    cursor = pattern.lastIndex;
    match = pattern.exec(value);
  }

  if (children.length === 0) return null;
  if (cursor < value.length) {
    children.push({ type: "text", value: value.slice(cursor) });
  }
  return children;
}

export const remarkCampusReferences: Plugin<
  [
    {
      resolveReference?: CampusReferenceResolver;
    }?,
  ],
  Root
> = (options = {}) => {
  const resolveReference =
    options.resolveReference ?? defaultCampusReferenceHref;

  return (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      const mutableParent = parent as MutableTextParent | undefined;
      if (index === undefined || !parent || parent.type === "link") return;

      const children = replaceCampusReferences(
        String(node.value ?? ""),
        resolveReference,
      );
      if (!children) return;

      mutableParent?.children.splice(index, 1, ...children);
    });
  };
};

export const campusReferenceMarkdownPlugins: PluggableList = [
  [remarkCampusReferences, { resolveReference: defaultCampusReferenceHref }],
];
