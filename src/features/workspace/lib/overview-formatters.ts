export function formatMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    values[key] == null ? "" : String(values[key]),
  );
}

export function fmtTime(value: number | null | undefined) {
  if (value == null) return "";
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}
