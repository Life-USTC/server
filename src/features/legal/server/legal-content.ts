import type { AppLocale } from "@/i18n/config";
import { renderMarkdown } from "@/lib/components/markdown-preview-renderer";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

export type LegalSection = {
  title: string;
  items: string[];
};

export type LegalContent = {
  title: string;
  intro: string;
  sections: LegalSection[];
  mdx: string;
};

type LegalMessageContent = Omit<LegalContent, "mdx">;

const legalMessages = {
  "en-us": enUsMessages.legal,
  "zh-cn": zhCnMessages.legal,
} satisfies Record<
  AppLocale,
  {
    privacy: LegalMessageContent;
    terms: LegalMessageContent;
  }
>;

function legalContentToMdx(content: LegalMessageContent) {
  return [
    `# ${content.title}`,
    content.intro,
    ...content.sections.flatMap((section) => [
      `## ${section.title}`,
      ...section.items.map((item) => `- ${item}`),
    ]),
  ].join("\n\n");
}

export type LegalDocumentKey = "privacy" | "terms";

export function getLegalContent(locale: AppLocale, key: LegalDocumentKey) {
  const content = legalMessages[locale][key];
  return {
    ...content,
    mdx: legalContentToMdx(content),
  };
}

/** Legal page payload shared by `/privacy` and `/terms`: copy plus rendered HTML. */
export function getLegalPageContent(locale: AppLocale, key: LegalDocumentKey) {
  const content = getLegalContent(locale, key);
  return {
    ...content,
    renderedHtml: renderMarkdown(content.mdx),
  };
}
