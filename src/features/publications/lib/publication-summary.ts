function compact(value: string) {
  return value.replace(/\s+/gu, "").replace(/[。.!！?？:：]+$/u, "");
}

const URL_IN_TEXT = /https?:\/\/\S+/giu;
const LIST_URL_MAX = 48;

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

/**
 * List-row summary: omit empties, and shorten embedded long URLs so a single
 * line clamp stays readable instead of stretching the row.
 */
export function publicationListSummary(
  title: string,
  summary: string | null | undefined,
) {
  const text = publicationSummary(title, summary);
  if (!text) return "";
  if (!URL_IN_TEXT.test(text)) return text;
  URL_IN_TEXT.lastIndex = 0;
  return text.replace(URL_IN_TEXT, (url) =>
    url.length > LIST_URL_MAX ? `${url.slice(0, LIST_URL_MAX - 1)}…` : url,
  );
}

/** True when the list summary contains a URL that should use a one-line clamp. */
export function publicationListSummaryIsUrlHeavy(summary: string) {
  URL_IN_TEXT.lastIndex = 0;
  return URL_IN_TEXT.test(summary);
}
