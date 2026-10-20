const JUNK_LABEL =
  /^(网站|栏目|首页|未知|none|null|undefined|n\/?a|site|category|unknown|—|–|-|\.{1,3})$/iu;

/**
 * Keep structured attribution that helps a reader; drop crawler site/栏目
 * placeholders that only repeat chrome already shown as source + date.
 */
export function publicationAttributionValue(
  value: string | null | undefined,
): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  if (JUNK_LABEL.test(text)) return null;
  if (/^https?:\/\/\S+$/iu.test(text)) return null;
  if (/^[\p{P}\p{S}\s]+$/u.test(text)) return null;
  return text;
}
