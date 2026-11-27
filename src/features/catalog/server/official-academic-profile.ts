import type { RootContent } from "hast";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import type { OfficialAcademicProfile } from "@/features/catalog/lib/official-academic-profile";

const htmlParser = unified().use(rehypeParse, { fragment: true }).freeze();
const skippedElements = new Set(["script", "style", "template", "iframe"]);
const paragraphElements = new Set([
  "p",
  "div",
  "li",
  "tr",
  "h1",
  "h2",
  "h3",
  "h4",
  "br",
]);

function plainText(node: RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type !== "element" || skippedElements.has(node.tagName)) return "";
  const content = node.children.map(plainText).join("");
  return paragraphElements.has(node.tagName) ? `\n${content}\n` : content;
}

function string(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function richText(value: unknown) {
  const input = string(value);
  if (!input || !/<[a-z!/]|&(?:#|[a-z]+;)/i.test(input)) return input;
  return (
    htmlParser
      .parse(input)
      .children.map(plainText)
      .join("")
      .replace(/\n[ \t]*\n+/g, "\n")
      .trim() || null
  );
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function documentObject(value: unknown) {
  if (typeof value !== "string") return object(value);
  try {
    return object(JSON.parse(value));
  } catch {
    return {};
  }
}

function paragraphs(value: unknown) {
  return list(object(value).paragraphs).flatMap((item) => {
    const paragraph = object(item);
    const content = richText(paragraph.content);
    return content ? [{ title: richText(paragraph.title), content }] : [];
  });
}

export function toOfficialAcademicProfile(
  value: unknown,
): OfficialAcademicProfile | null {
  if (Object.keys(object(value)).length === 0) return null;
  const profile = object(value);
  const description = object(profile.desc);
  const syllabus = object(profile.syllabus);
  const documents = documentObject(syllabus.documents);

  return {
    credits: number(profile.credit),
    hours: number(profile.hour),
    department: string(profile.dept),
    language: string(profile.lessonLang) ?? string(profile.lang),
    prerequisites: richText(profile.preq),
    assessment: richText(profile.examType),
    grading: richText(profile.grading),
    description: { zh: richText(description.cn), en: richText(description.en) },
    textbook: richText(profile.textbook),
    textbooks: list(profile.textbooks).flatMap((item) => {
      const book = object(item);
      const nameZh = string(book.nameZh);
      const nameEn = string(book.nameEn);
      return nameZh || nameEn
        ? [
            {
              nameZh,
              nameEn,
              author: string(book.author),
              isbn: string(book.isbn),
            },
          ]
        : [];
    }),
    references: richText(profile.ref),
    syllabus: {
      zh: paragraphs(documents["language-zh"]),
      en: paragraphs(documents["language-en"]),
      topics: list(syllabus.periods).flatMap((item) => {
        const topic = object(item);
        const name = string(topic.nameZh) ?? string(topic.experiment);
        return name ? [{ name, hours: number(topic.period) }] : [];
      }),
    },
  };
}
