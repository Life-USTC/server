export function isZhLocale(locale: string): boolean {
  const l = locale.toLowerCase().replace(/_/g, "-");
  return l === "zh-cn" || l.startsWith("zh-") || l === "zh";
}

export function intlLocale(locale: string): string {
  const normalized = locale.replace(/_/g, "-");
  if (isZhLocale(normalized)) return "zh-CN";
  return normalized.length >= 2 ? normalized : "en-US";
}
