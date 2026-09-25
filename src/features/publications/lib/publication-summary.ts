function compact(value: string) {
  return value.replace(/\s+/gu, "").replace(/[。.!！?？:：]+$/u, "");
}

/** Hide crawler placeholders and text already visible as the title/body lead. */
export function publicationSummary(
  title: string,
  summary: string | null | undefined,
  bodyMarkdown?: string | null,
) {
  const text = summary?.trim() ?? "";
  if (!text || /^https?:\/\/\S+$/iu.test(text)) return "";
  const normalized = compact(text);
  if (!normalized || normalized === compact(title)) return "";
  if (bodyMarkdown && compact(bodyMarkdown).startsWith(normalized)) return "";
  return text;
}
