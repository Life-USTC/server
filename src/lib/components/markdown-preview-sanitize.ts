import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

export { rehypeSanitize };

export const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "aria-label",
      "className",
      "href",
      "rel",
      "target",
    ],
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), "className"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    div: [...(defaultSchema.attributes?.div ?? []), "className"],
    h1: [...(defaultSchema.attributes?.h1 ?? []), "className"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "className"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "className"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "className"],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "align",
      "alt",
      "className",
      "height",
      "src",
      "title",
      "width",
    ],
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      "checked",
      "className",
      "disabled",
      "type",
    ],
    li: [...(defaultSchema.attributes?.li ?? []), "className"],
    mark: [...(defaultSchema.attributes?.mark ?? []), "className"],
    ol: [...(defaultSchema.attributes?.ol ?? []), "className"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    td: [...(defaultSchema.attributes?.td ?? []), "align", "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align", "className"],
    ul: [...(defaultSchema.attributes?.ul ?? []), "className"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "del",
    "ins",
    "mark",
    "sub",
    "sup",
  ],
};
