import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../messages/en-us.json";
import zhCnMessages from "../../messages/zh-cn.json";

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

export function getLegalContent(locale: AppLocale, key: "privacy" | "terms") {
  const content = legalMessages[locale][key];
  return {
    ...content,
    mdx: legalContentToMdx(content),
  };
}
