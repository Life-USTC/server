import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageLayout } from "@/components/page-layout";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { CommentMarkdown } from "@/features/comments/components/comment-markdown";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("commentsGuide");
  return {
    title: t("title"),
  };
}

export default async function MarkdownSupportGuidePage() {
  const t = await getTranslations("commentsGuide");

  const sections = [
    {
      title: t("markdownTitle"),
      description: t("markdownDescription"),
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
      title: t("tableTitle"),
      description: t("tableDescription"),
      code: `| Option | Description |
| ------ | ----------- |
| data   | path to data files |
| engine | template engine |
| ext    | file extension |`,
    },
    {
      title: t("mathTitle"),
      description: t("mathDescription"),
      code: `Inline: $E = mc^2$

Block:
$$
\\int_0^\\infty e^{-x} dx = 1
$$`,
    },
    {
      title: t("typographyTitle"),
      description: t("typographyDescription"),
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
      title: t("mdxTitle"),
      description: t("mdxDescription"),
      code: `![Life@USTC icon](/images/icon.png){width=96 align=center}

::::center
**Centered content using Directives**
::::`,
    },
  ];

  return (
    <PageLayout title={t("title")} description={t("subtitle")}>
      <div className="space-y-8 pb-20">
        {sections.map((section) => (
          <div
            key={section.title}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardPanel className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  {section.description}
                </p>
                <div className="group relative">
                  <pre className="overflow-x-auto rounded-xl border border-muted-foreground/10 bg-muted p-4 font-mono text-xs">
                    {section.code}
                  </pre>
                </div>
              </CardPanel>
            </Card>

            <Card className="h-full border-primary/10 bg-primary/5">
              <CardHeader>
                <CardTitle className="font-medium text-primary/60 text-sm uppercase tracking-wider">
                  {t("previewTitle")}
                </CardTitle>
              </CardHeader>
              <CardPanel className="m-4 rounded-lg border bg-background p-6 shadow-sm">
                <CommentMarkdown content={section.code} />
              </CardPanel>
            </Card>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
