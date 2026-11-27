import { formatTime } from "@/shared/lib/clock-time-format";
export function formatMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    values[key] == null ? "" : String(values[key]),
  );
}

export function fmtTime(value: number | null | undefined) {
  return formatTime(value, "");
}
