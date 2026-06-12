type MarkdownGuideCopy = {
  markdownTitle: string;
  markdownDescription: string;
  tableTitle: string;
  tableDescription: string;
  mathTitle: string;
  mathDescription: string;
  typographyTitle: string;
  typographyDescription: string;
  mdxTitle: string;
  mdxDescription: string;
};

export function buildMarkdownGuideSections(guide: MarkdownGuideCopy) {
  return [
    {
      title: guide.markdownTitle,
      description: guide.markdownDescription,
      code: `**Bold** *Italic* ~~Strikethrough~~

- List Item 1
  - Sub Item
- List Item 2

1. Ordered Item 1
2. Ordered Item 2

> Blockquote can be nested
>> Nested level 2`,
    },
    {
      title: guide.tableTitle,
      description: guide.tableDescription,
      code: `| Option | Description |
| ------ | ----------- |
| data   | path to data files |
| engine | template engine |
| ext    | file extension |`,
    },
    {
      title: guide.mathTitle,
      description: guide.mathDescription,
      code: `Inline: $E = mc^2$

Block:
$$
\\int_0^\\infty e^{-x} dx = 1
$$`,
    },
    {
      title: guide.typographyTitle,
      description: guide.typographyDescription,
      code: `Emoji: :smile: :rocket: :tada:

Sup/Sub: H~2~O, 2^10^

Ins/Mark: ++Inserted text++, ==Marked text==

::::tip
This is a helpful tip!
::::

::::warning
Watch out for this.
::::

::::error
Something went wrong.
::::`,
    },
    {
      title: guide.mdxTitle,
      description: guide.mdxDescription,
      code: `![Life@USTC icon](/images/icon.png){width=96 align=center}

::::center
**Centered content using Directives**
::::`,
    },
  ];
}
